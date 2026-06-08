import { SendEmailCommand } from "@aws-sdk/client-ses";
import { getPool } from "../db/pool";
import { sesClient as ses } from "../lib/aws";

const FROM = process.env.ALERT_FROM_EMAIL ?? "alerts@vaultsync.io";

/** Best-effort SES email to the configured alert address. No-op if none is set. */
export async function emailAlert(subject: string, body: string): Promise<void> {
  try {
    const { rows } = await getPool().query(`SELECT alert_email FROM app_settings WHERE id = 1`);
    const to: string | null = rows[0]?.alert_email ?? null;
    if (!to) return;
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
