import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { S3Client } from "@aws-sdk/client-s3";
import { SESClient } from "@aws-sdk/client-ses";

// Single source for AWS client configuration. Previously the same
// region/endpoint/credentials block was hand-written in keys.ts, lifecycle.ts,
// and notifier.ts — drift between them was a latent bug.
export const awsClientConfig = {
  region: process.env.AWS_REGION ?? "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
};

// Shared singletons — these SDK clients are cheap to share and thread-safe.
export const secretsClient = new SecretsManagerClient(awsClientConfig);
export const s3Client = new S3Client({ ...awsClientConfig, forcePathStyle: true });
export const sesClient = new SESClient(awsClientConfig);
