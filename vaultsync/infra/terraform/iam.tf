# Least-privilege policy for the app workloads (api / validator / edge), plus a
# task role assumable by ECS. Attach this role to the ECS task definitions (or
# adapt the assume policy for EC2 instance profiles / EKS IRSA).

data "aws_iam_policy_document" "app_access" {
  statement {
    sid       = "BackupBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.backups.arn}/*"]
  }
  statement {
    sid       = "BackupBucketList"
    actions   = ["s3:ListBucket", "s3:GetBucketLifecycleConfiguration", "s3:PutBucketLifecycleConfiguration"]
    resources = [aws_s3_bucket.backups.arn]
  }
  statement {
    sid       = "ValidationQueue"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.validation.arn]
  }
  statement {
    sid       = "EncryptionKey"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue"]
    resources = [aws_secretsmanager_secret.aes_key.arn]
  }
  statement {
    sid       = "SendAlertEmail"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "app_access" {
  name   = "${local.name}-app-access"
  policy = data.aws_iam_policy_document.app_access.json
  tags   = local.tags
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app_task" {
  name               = "${local.name}-app-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "app_access" {
  role       = aws_iam_role.app_task.name
  policy_arn = aws_iam_policy.app_access.arn
}
