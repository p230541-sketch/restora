import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SESClient } from "@aws-sdk/client-ses";

// Single AWS client configuration for the validator. Previously the same
// region/endpoint/credentials block was repeated in poller.ts, handler.ts,
// and notifier.ts.
export const awsConfig = {
  region: process.env.AWS_REGION ?? "us-east-1",
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
};

export const s3Client = new S3Client({ ...awsConfig, forcePathStyle: true });
export const secretsClient = new SecretsManagerClient(awsConfig);
export const sqsClient = new SQSClient(awsConfig);
export const sesClient = new SESClient(awsConfig);
