# Encrypted, versioned, private backup bucket with retention lifecycle —
# the real-AWS equivalent of the LocalStack bucket from infra/localstack/bootstrap.sh.

resource "aws_s3_bucket" "backups" {
  bucket = var.backup_bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "vaultsync-backup-retention"
    status = "Enabled"
    filter {
      prefix = "backups/"
    }
    expiration {
      days = var.backup_retention_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# S3 → SQS event notification (drives the validator).
resource "aws_s3_bucket_notification" "backups" {
  bucket = aws_s3_bucket.backups.id

  queue {
    queue_arn     = aws_sqs_queue.validation.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "backups/"
  }

  depends_on = [aws_sqs_queue_policy.allow_s3]
}
