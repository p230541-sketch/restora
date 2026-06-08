# SES sender identity for alert emails. Email-identity verification requires the
# owner to click the confirmation link AWS sends. To send to arbitrary recipients
# you must also request production access (exit the SES sandbox). For higher
# volume / deliverability, verify a domain identity (aws_sesv2_email_identity)
# with DKIM instead of a single address.

resource "aws_ses_email_identity" "alert_from" {
  email = var.alert_from_email
}
