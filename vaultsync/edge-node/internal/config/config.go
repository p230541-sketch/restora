package config

import (
	"fmt"
	"os"
)

type Config struct {
	CronSchedule    string
	NodeID          string
	NodeIP          string
	SourceDBDSN     string
	SpoolDir        string
	S3Bucket        string
	SecretID        string
	AWSEndpointURL  string
	AWSRegion       string
	TelemetryDBDSN  string
	TriggerHTTPPort string
	APIBaseURL      string
}

func Load() (*Config, error) {
	c := &Config{
		CronSchedule:    getEnv("CRON_SCHEDULE", "0 * * * *"),
		NodeID:          getEnv("NODE_ID", "default-node"),
		NodeIP:          getEnv("NODE_IP", "127.0.0.1"),
		SourceDBDSN:     mustEnv("SOURCE_DB_DSN"),
		SpoolDir:        getEnv("SPOOL_DIR", "/var/spool/vaultsyncd"),
		S3Bucket:        mustEnv("S3_BUCKET"),
		SecretID:        mustEnv("SECRET_ID"),
		AWSEndpointURL:  getEnv("AWS_ENDPOINT_URL", ""),
		AWSRegion:       getEnv("AWS_REGION", "us-east-1"),
		TelemetryDBDSN:  getEnv("TELEMETRY_DB_DSN", ""),
		TriggerHTTPPort: getEnv("TRIGGER_HTTP_PORT", "9100"),
		APIBaseURL:      getEnv("API_URL", ""),
	}
	if err := os.MkdirAll(c.SpoolDir, 0700); err != nil {
		return nil, fmt.Errorf("cannot create spool dir: %w", err)
	}
	return c, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required env var %s is not set", key))
	}
	return v
}
