# AES-256 backup encryption key in Secrets Manager (64 hex chars = 32 bytes),
# matching what the daemon/validator expect. Generated once by Terraform; rotate
# afterwards via the app's "Rotate Key" action (PutSecretValue).

resource "random_id" "aes_key" {
  byte_length = 32
}

resource "aws_secretsmanager_secret" "aes_key" {
  name                    = "${var.project}/${var.environment}/aes-key"
  description             = "VaultSync AES-256 backup encryption key"
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "aes_key" {
  secret_id     = aws_secretsmanager_secret.aes_key.id
  secret_string = random_id.aes_key.hex

  # The app rotates this in place; don't let Terraform clobber a rotated value.
  lifecycle {
    ignore_changes = [secret_string]
  }
}
