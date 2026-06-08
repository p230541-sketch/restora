import { SendEmailCommand } from "@aws-sdk/client-ses";
import { sesClient as ses } from "./aws";

const FROM = process.env.ALERT_FROM_EMAIL ?? "alerts@vaultsync.io";

/** Best-effort SES email. No-op if `to` is empty. */
export async function sendEmail(to: string | null, subject: string, body: string): Promise<void> {
  if (!to) return;
  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [to] },
        Message: { Subject: { Data: subject }, Body: { Text: { Data: body } } },
      })
    );
    console.log(`[notifier] emailed ${to}: ${subject}`);
  } catch (err: any) {
    console.error("[notifier] send failed:", err.message);
  }
}
