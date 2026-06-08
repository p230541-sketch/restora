import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient as sqs } from "./aws";
import { handler, S3EventRecord } from "./handler";

const QUEUE_URL = process.env.SQS_QUEUE_URL!;

// Validate one message end-to-end. Each backup is independent (its own
// ephemeral DB), so a batch can be processed concurrently.
async function processMessage(msg: { Body?: string; ReceiptHandle?: string }): Promise<void> {
  let body: any;
  try {
    body = JSON.parse(msg.Body ?? "{}");
  } catch {
    console.error("[poller] Failed to parse SQS message body");
    return;
  }

  // LocalStack wraps the S3 notification inside a top-level "Records" or "Message"
  const records: S3EventRecord[] =
    body.Records ?? (body.Message ? JSON.parse(body.Message).Records : []);

  if (records && records.length > 0) {
    try {
      await handler({ Records: records });
    } catch (err) {
      console.error("[poller] Handler error:", err);
    }
  }
  await deleteMsgSafe(msg.ReceiptHandle!);
}

async function poll(): Promise<void> {
  while (true) {
    try {
      const resp = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20, // long-poll
        })
      );
      // Process the batch concurrently instead of one-at-a-time.
      await Promise.all((resp.Messages ?? []).map(processMessage));
    } catch (err: any) {
      console.error("[poller] SQS receive error:", err.message);
      await sleep(5000);
    }
  }
}

async function deleteMsgSafe(receiptHandle: string): Promise<void> {
  try {
    await sqs.send(
      new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle })
    );
  } catch (err) {
    console.error("[poller] Failed to delete SQS message:", err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

console.log("[poller] VaultSync validator started. Polling:", QUEUE_URL);
poll().catch((err) => {
  console.error("[poller] Fatal:", err);
  process.exit(1);
});
