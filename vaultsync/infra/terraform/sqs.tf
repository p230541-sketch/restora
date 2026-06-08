# Validation queue + dead-letter queue. Poison messages move to the DLQ after
# maxReceiveCount so a single bad backup can't block the pipeline.

resource "aws_sqs_queue" "validation_dlq" {
  name                      = "${local.name}-validation-dlq"
  message_retention_seconds = 1209600 # 14 days
  tags                      = local.tags
}

resource "aws_sqs_queue" "validation" {
  name                       = "${local.name}-validation"
  visibility_timeout_seconds = 300 # ≥ validator processing time
  message_retention_seconds  = 345600
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.validation_dlq.arn
    maxReceiveCount     = 5
  })
  tags = local.tags
}

# Allow only this S3 bucket to publish to the queue.
resource "aws_sqs_queue_policy" "allow_s3" {
  queue_url = aws_sqs_queue.validation.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowS3Notify"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.validation.arn
      Condition = { ArnLike = { "aws:SourceArn" = aws_s3_bucket.backups.arn } }
    }]
  })
}
