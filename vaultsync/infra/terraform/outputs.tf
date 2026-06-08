# These outputs map directly onto the app's environment variables — see
# the "Env mapping" table in docs/DEPLOY.md.

output "backup_bucket" {
  description = "S3_BUCKET"
  value       = aws_s3_bucket.backups.id
}

output "sqs_queue_url" {
  description = "SQS_QUEUE_URL"
  value       = aws_sqs_queue.validation.url
}

output "secret_id" {
  description = "SECRET_ID"
  value       = aws_secretsmanager_secret.aes_key.name
}

output "telemetry_db_endpoint" {
  description = "Host:port for TELEMETRY_DB_DSN"
  value       = aws_db_instance.telemetry.endpoint
}

output "app_task_role_arn" {
  description = "Attach to ECS task definitions for AWS access."
  value       = aws_iam_role.app_task.arn
}

output "alert_from_identity" {
  description = "ALERT_FROM_EMAIL (verify before sending)."
  value       = aws_ses_email_identity.alert_from.email
}
