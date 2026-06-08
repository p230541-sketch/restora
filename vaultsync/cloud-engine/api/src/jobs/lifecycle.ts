import {
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import { s3Client as s3 } from "../lib/aws";

const BUCKET = process.env.S3_BUCKET ?? "vaultsync-backups";
const RULE_ID = "vaultsync-backup-retention";

/** Apply an S3 lifecycle rule that expires backup objects after `retentionDays`. */
export async function applyLifecycle(retentionDays: number): Promise<void> {
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: RULE_ID,
            Status: "Enabled",
            Filter: { Prefix: "backups/" },
            Expiration: { Days: retentionDays },
          },
        ],
      },
    })
  );
  console.log(`[lifecycle] S3 retention set to ${retentionDays} day(s) on ${BUCKET}`);
}

/** Read the currently-applied expiration window, or null if none is set. */
export async function getLifecycleDays(): Promise<number | null> {
  try {
    const out = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET }));
    const rule = out.Rules?.find((r) => r.ID === RULE_ID);
    return rule?.Expiration?.Days ?? null;
  } catch {
    return null;
  }
}
