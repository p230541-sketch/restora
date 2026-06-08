package uploader

import (
	"bytes"
	"context"
	"fmt"
	"math"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Client interface {
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

const (
	maxRetries = 7
	baseDelay  = 2 * time.Second
)

// Upload sends data to S3 with exponential backoff on failure.
func Upload(ctx context.Context, client S3Client, bucket, key string, data []byte) error {
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(math.Pow(2, float64(attempt))) * baseDelay
			if delay > 5*time.Minute {
				delay = 5 * time.Minute
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		_, err := client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(data),
			ContentType: aws.String("application/octet-stream"),
		})
		if err == nil {
			return nil
		}
		lastErr = err
		fmt.Printf("[uploader] attempt %d failed: %v\n", attempt+1, err)
	}
	return fmt.Errorf("upload failed after %d attempts: %w", maxRetries, lastErr)
}
