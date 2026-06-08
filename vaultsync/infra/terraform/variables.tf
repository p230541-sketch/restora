variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "vaultsync"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "backup_bucket_name" {
  type        = string
  description = "Globally-unique S3 bucket name for encrypted backups."
}

variable "backup_retention_days" {
  type        = number
  default     = 30
  description = "Days before backup objects under backups/ expire (mirrors app retention_days)."
}

variable "alert_from_email" {
  type        = string
  description = "Verified SES sender address for alert emails."
}

# ── RDS (telemetry DB) ───────────────────────────────────────────────────────
variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "telemetry"
}

variable "db_username" {
  type    = string
  default = "vaultsync"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Telemetry DB password. Supply via TF_VAR_db_password or a secret backend — never hardcode."
}

variable "vpc_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for the RDS subnet group."
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "Security groups permitting the app tasks to reach RDS:5432."
}

variable "tags" {
  type    = map(string)
  default = {}
}
