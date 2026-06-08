# Managed Postgres for the telemetry DB. (The source DB is the customer's own;
# the ephemeral validation DB can be a short-lived container or a separate RDS.)
# Storage is encrypted, deletion-protected, with automated backups.

resource "aws_db_subnet_group" "telemetry" {
  name       = "${local.name}-telemetry"
  subnet_ids = var.vpc_subnet_ids
  tags       = local.tags
}

resource "aws_db_instance" "telemetry" {
  identifier             = "${local.name}-telemetry"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = var.db_allocated_storage * 5
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.telemetry.name
  vpc_security_group_ids = var.vpc_security_group_ids
  multi_az               = false # set true for production HA

  backup_retention_period   = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-telemetry-final"

  tags = local.tags
}
