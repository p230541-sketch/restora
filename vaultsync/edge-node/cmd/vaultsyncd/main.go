package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/robfig/cron/v3"

	"github.com/vaultsync/edge-node/internal/config"
	"github.com/vaultsync/edge-node/internal/crypto"
	"github.com/vaultsync/edge-node/internal/dump"
	"github.com/vaultsync/edge-node/internal/spool"
	"github.com/vaultsync/edge-node/internal/uploader"
)

func main() {
	runNow := flag.Bool("run-now", false, "execute one backup immediately and exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	awsCfg, err := buildAWSConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("aws config: %v", err)
	}

	smClient := secretsmanager.NewFromConfig(awsCfg)
	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	runBackup := func() {
		if err := executeBackup(ctx, cfg, smClient, s3Client); err != nil {
			log.Printf("[backup] ERROR: %v", err)
		}
	}

	if *runNow {
		runBackup()
		return
	}

	// Retry any previously spooled payloads on startup
	go retrySpool(ctx, cfg, smClient, s3Client)

	// HTTP trigger endpoint (FR-10)
	mux := http.NewServeMux()
	mux.HandleFunc("/trigger", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		log.Println("[trigger] Manual backup requested via HTTP")
		go runBackup()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "node": cfg.NodeID})
	})
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(collectMetrics(cfg.SpoolDir))
	})

	srv := &http.Server{
		Addr:    ":" + cfg.TriggerHTTPPort,
		Handler: mux,
	}
	go func() {
		log.Printf("[daemon] HTTP trigger listening on :%s", cfg.TriggerHTTPPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[daemon] HTTP server error: %v", err)
		}
	}()

	// Cron scheduler
	c := cron.New()
	entryID, err := c.AddFunc(cfg.CronSchedule, runBackup)
	if err != nil {
		log.Fatalf("invalid cron schedule %q: %v", cfg.CronSchedule, err)
	}
	c.Start()
	log.Printf("[daemon] VaultSync edge node %s started. Cron: %s", cfg.NodeID, cfg.CronSchedule)

	// Live-reschedule from the control plane when the schedule changes
	if cfg.APIBaseURL != "" {
		go watchSchedule(ctx, c, cfg.APIBaseURL, cfg.CronSchedule, entryID, runBackup)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("[daemon] Shutting down...")
	c.Stop()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	srv.Shutdown(shutCtx)
}

func executeBackup(ctx context.Context, cfg *config.Config, smClient *secretsmanager.Client, s3Client *s3.Client) error {
	// Exception 1: disk space check (NFR / Edge Case 1)
	usedPct := spool.DiskUsagePercent(cfg.SpoolDir)
	if usedPct > 95 {
		return fmt.Errorf("disk usage %.1f%% exceeds 95%% threshold — aborting dump", usedPct)
	}

	log.Printf("[backup] Starting dump for node %s", cfg.NodeID)

	sqlBytes, err := dump.Run(cfg.SourceDBDSN)
	if err != nil {
		return fmt.Errorf("dump: %w", err)
	}
	log.Printf("[backup] Dump complete: %d bytes", len(sqlBytes))

	// Compress BEFORE encryption — ciphertext is high-entropy and won't compress.
	compressed, err := gzipBytes(sqlBytes)
	if err != nil {
		return fmt.Errorf("compress: %w", err)
	}
	ratio := 100 * (1 - float64(len(compressed))/float64(len(sqlBytes)))
	log.Printf("[backup] Compressed: %d → %d bytes (-%.1f%%)", len(sqlBytes), len(compressed), ratio)

	key, err := crypto.FetchKey(ctx, smClient, cfg.SecretID)
	if err != nil {
		return fmt.Errorf("fetch key: %w", err)
	}

	encrypted, err := crypto.Encrypt(key, compressed)
	if err != nil {
		return fmt.Errorf("encrypt: %w", err)
	}
	// Zero out plaintext, compressed copy, and key from memory
	for i := range sqlBytes {
		sqlBytes[i] = 0
	}
	for i := range compressed {
		compressed[i] = 0
	}
	for i := range key {
		key[i] = 0
	}
	log.Printf("[backup] Encrypted: %d bytes", len(encrypted))

	entry, err := spool.Write(cfg.SpoolDir, cfg.NodeID, encrypted)
	if err != nil {
		return fmt.Errorf("spool write: %w", err)
	}
	log.Printf("[backup] Spooled to %s (key: %s)", entry.Path, entry.Key)

	if err := uploader.Upload(ctx, s3Client, cfg.S3Bucket, entry.Key, encrypted); err != nil {
		return fmt.Errorf("upload: %w (payload remains in spool)", err)
	}

	spool.Delete(entry.Path)
	log.Printf("[backup] Uploaded %s → s3://%s/%s", cfg.NodeID, cfg.S3Bucket, entry.Key)
	return nil
}

func retrySpool(ctx context.Context, cfg *config.Config, smClient *secretsmanager.Client, s3Client *s3.Client) {
	entries, err := spool.List(cfg.SpoolDir)
	if err != nil || len(entries) == 0 {
		return
	}
	log.Printf("[spool] Found %d pending entries to retry", len(entries))
	for _, e := range entries {
		data, err := os.ReadFile(e.Path)
		if err != nil {
			log.Printf("[spool] Cannot read %s: %v", e.Path, err)
			continue
		}
		if err := uploader.Upload(ctx, s3Client, cfg.S3Bucket, e.Key, data); err != nil {
			log.Printf("[spool] Retry failed for %s: %v", e.Key, err)
			continue
		}
		spool.Delete(e.Path)
		log.Printf("[spool] Retry uploaded %s", e.Key)
	}
}

func buildAWSConfig(ctx context.Context, cfg *config.Config) (aws.Config, error) {
	opts := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(cfg.AWSRegion),
	}
	if cfg.AWSEndpointURL != "" {
		// Custom endpoint resolver for LocalStack
		customResolver := awsconfig.WithEndpointResolverWithOptions(
			endpointResolver(cfg.AWSEndpointURL),
		)
		opts = append(opts, customResolver)
	}
	return awsconfig.LoadDefaultConfig(ctx, opts...)
}

// watchSchedule polls the control-plane API and live-reschedules the cron job
// whenever the configured cron_schedule changes. Invalid schedules are ignored
// so a bad value can never take the daemon's backups offline.
func watchSchedule(ctx context.Context, c *cron.Cron, apiURL, initial string, entryID cron.EntryID, job func()) {
	current := initial
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			next, err := fetchSchedule(ctx, apiURL)
			if err != nil {
				log.Printf("[schedule] poll failed: %v", err)
				continue
			}
			if next == "" || next == current {
				continue
			}
			// Validate by registering the new schedule before removing the old one.
			newID, err := c.AddFunc(next, job)
			if err != nil {
				log.Printf("[schedule] rejecting invalid cron %q from API, keeping %q: %v", next, current, err)
				continue
			}
			c.Remove(entryID)
			entryID = newID
			current = next
			log.Printf("[schedule] cron schedule updated to %q", current)
		}
	}
}

func fetchSchedule(ctx context.Context, apiURL string) (string, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, apiURL+"/api/settings", nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	var payload struct {
		CronSchedule string `json:"cron_schedule"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	return payload.CronSchedule, nil
}
