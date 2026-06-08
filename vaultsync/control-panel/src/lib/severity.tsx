import { LucideIcon, XCircle, AlertTriangle, Info } from "lucide-react";
import { colors } from "../styles/theme";
import { AlertSeverity } from "../api/client";

/**
 * Colour + icon component for an alert severity. The icon is exposed as a
 * component (not a pre-sized element) so each call site picks its own size —
 * the bell uses 15px, the Alerts page uses 16px.
 */
export const SEVERITY: Record<AlertSeverity, { color: string; Icon: LucideIcon }> = {
  critical: { color: colors.red, Icon: XCircle },
  warning: { color: colors.orange, Icon: AlertTriangle },
  info: { color: colors.blue, Icon: Info },
};

/** Threshold colour for a utilisation percentage (CPU/RAM/disk gauges). */
export function utilizationColor(pct: number): string {
  if (pct >= 90) return colors.red;
  if (pct >= 70) return colors.orange;
  return colors.green;
}
