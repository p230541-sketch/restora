#!/usr/bin/env bash
set -euo pipefail

ENDPOINT=http://localstack:4566
REGION=us-east-1
BUCKET=vaultsync-backups
QUEUE=vaultsync-validation
SECRET_ID=vaultsync/aes-key

echo "[bootstrap] Waiting for LocalStack..."
until curl -sf "$ENDPOINT/_localstack/health" | grep -q '"s3": "available"'; do
  sleep 2
done
echo "[bootstrap] LocalStack ready."

# ── S3 bucket ─────────────────────────────────────────────────────────────
aws --endpoint-url="$ENDPOINT" --region="$REGION" s3api create-bucket \
  --bucket "$BUCKET" 2>/dev/null || echo "[bootstrap] Bucket already exists."

# ── SQS queue ─────────────────────────────────────────────────────────────
QUEUE_URL=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" sqs create-queue \
  --queue-name "$QUEUE" \
  --query 'QueueUrl' --output text)
echo "[bootstrap] Queue: $QUEUE_URL"

QUEUE_ARN=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)
echo "[bootstrap] Queue ARN: $QUEUE_ARN"

# ── S3 → SQS event notification ────────────────────────────────────────────
aws --endpoint-url="$ENDPOINT" --region="$REGION" s3api put-bucket-notification-configuration \
  --bucket "$BUCKET" \
  --notification-configuration "{
    \"QueueConfigurations\": [{
      \"QueueArn\": \"$QUEUE_ARN\",
      \"Events\": [\"s3:ObjectCreated:*\"]
    }]
  }"
echo "[bootstrap] S3->SQS notification configured."

# ── AES-256 key in Secrets Manager ─────────────────────────────────────────
# 32 random bytes → hex string (64 chars = 256-bit key)
AES_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
if aws --endpoint-url="$ENDPOINT" --region="$REGION" secretsmanager create-secret \
  --name "$SECRET_ID" \
  --secret-string "$AES_KEY" 2>/dev/null; then
  echo "[bootstrap] AES-256 key stored in Secrets Manager as '$SECRET_ID'."
else
  echo "[bootstrap] Secret '$SECRET_ID' already exists — keeping existing key (spool files remain valid)."
fi

# ── SES identities (for alert emails) ──────────────────────────────────────
for ADDR in alerts@vaultsync.io ops@vaultsync.io; do
  aws --endpoint-url="$ENDPOINT" --region="$REGION" ses verify-email-identity \
    --email-address "$ADDR" 2>/dev/null || true
done
echo "[bootstrap] SES sender/recipient identities verified."

echo "[bootstrap] Done."
