import React, { useEffect, useState } from "react";
import { Clock, HardDrive, Key, Bell, Save, RotateCcw } from "lucide-react";
import { api, AppSettings } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";

const card: React.CSSProperties = {
  background: colors.bgCard, border: `1px solid ${colors.border}`,
  borderRadius: 8, padding: 24, marginBottom: 16, maxWidth: 720,
};
const sectionTitle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700,
  color: colors.textPrimary, marginBottom: 4,
};
const sectionSub: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginBottom: 18 };
const label: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" };
const inputStyle: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "9px 12px", color: colors.textPrimary, fontSize: 13, width: "100%", outline: "none",
};
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 4 };

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        background: checked ? colors.green : colors.border, position: "relative", transition: "background 0.15s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", transition: "left 0.15s",
      }} />
    </button>
  );
}

export function Settings() {
  const toast = useToast();
  const { hasRole } = useAuth();
  const canEdit = hasRole("SysAdmin");
  const [form, setForm] = useState<AppSettings | null>(null);
  const [original, setOriginal] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => { setForm(s); setOriginal(s); })
      .catch(() => toast.error("Could not load settings."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  const dirty = form && original && JSON.stringify(form) !== JSON.stringify(original);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await api.updateSettings({
        cron_schedule: form.cron_schedule,
        retention_days: form.retention_days,
        disk_threshold_pct: form.disk_threshold_pct,
        key_rotation_days: form.key_rotation_days,
        latency_sla_ms: form.latency_sla_ms,
        notify_on_failure: form.notify_on_failure,
        notify_on_success: form.notify_on_success,
        alert_email: form.alert_email,
      });
      setForm(saved);
      setOriginal(saved);
      toast.success("Settings saved.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (original) {
      setForm(original);
      toast.info("Reverted unsaved changes.");
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <TopBar title="Settings" />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Platform Settings</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            Backup policy, storage safety, key rotation, and alerting.
          </div>
        </div>

        {loading || !form ? (
          <div style={{ color: colors.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
            <Spinner size={14} color={colors.textSecondary} /> Loading settings…
          </div>
        ) : (
          <>
            {/* Backup schedule */}
            <div style={card}>
              <div style={sectionTitle}><Clock size={16} color={colors.blue} /> Backup Schedule</div>
              <div style={sectionSub}>How often each node snapshots and how long history is retained.</div>
              <div style={row}>
                <div>
                  <label style={label}>Cron Schedule</label>
                  <input style={inputStyle} value={form.cron_schedule}
                    onChange={(e) => set("cron_schedule", e.target.value)} placeholder="*/2 * * * *" />
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Standard 5-field cron. Applied to new daemon deployments.</div>
                </div>
                <div>
                  <label style={label}>Retention (days)</label>
                  <input type="number" min={1} max={365} style={inputStyle} value={form.retention_days}
                    onChange={(e) => set("retention_days", parseInt(e.target.value || "0", 10))} />
                  <div style={{ fontSize: 11, color: colors.green, marginTop: 4 }}>
                    ● S3 lifecycle active — backups expire after {form.retention_days} day{form.retention_days !== 1 ? "s" : ""}.
                  </div>
                </div>
              </div>
            </div>

            {/* Storage & safety */}
            <div style={card}>
              <div style={sectionTitle}><HardDrive size={16} color={colors.orange} /> Storage &amp; Safety</div>
              <div style={sectionSub}>Abort dumps when the spool disk is critically full.</div>
              <div>
                <label style={label}>Disk Abort Threshold — {form.disk_threshold_pct}%</label>
                <input type="range" min={50} max={100} value={form.disk_threshold_pct}
                  onChange={(e) => set("disk_threshold_pct", parseInt(e.target.value, 10))}
                  style={{ width: "100%", accentColor: colors.orange }} />
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Backups are skipped when spool usage exceeds this level.</div>
              </div>
              <div style={{ marginTop: 18, maxWidth: 320 }}>
                <label style={label}>Validation latency SLA (ms)</label>
                <input type="number" min={100} max={600000} step={100} style={inputStyle} value={form.latency_sla_ms}
                  onChange={(e) => set("latency_sla_ms", parseInt(e.target.value || "0", 10))} />
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>A warning alert is raised when a backup takes longer than this to validate.</div>
              </div>
            </div>

            {/* Security */}
            <div style={card}>
              <div style={sectionTitle}><Key size={16} color={colors.yellow} /> Key Rotation</div>
              <div style={sectionSub}>Reminder interval for rotating the AES-256 master key.</div>
              <div style={{ maxWidth: 320 }}>
                <label style={label}>Rotate every (days)</label>
                <input type="number" min={1} max={365} style={inputStyle} value={form.key_rotation_days}
                  onChange={(e) => set("key_rotation_days", parseInt(e.target.value || "0", 10))} />
              </div>
            </div>

            {/* Notifications */}
            <div style={card}>
              <div style={sectionTitle}><Bell size={16} color={colors.green} /> Notifications</div>
              <div style={sectionSub}>Where and when to send backup alerts.</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.borderMuted}` }}>
                <div>
                  <div style={{ fontSize: 13, color: colors.textPrimary }}>Alert on failure</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Notify when a backup fails validation.</div>
                </div>
                <Toggle checked={form.notify_on_failure} onChange={(v) => set("notify_on_failure", v)} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.borderMuted}` }}>
                <div>
                  <div style={{ fontSize: 13, color: colors.textPrimary }}>Alert on success</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Notify on every successful backup (noisy).</div>
                </div>
                <Toggle checked={form.notify_on_success} onChange={(v) => set("notify_on_success", v)} />
              </div>
              <div style={{ marginTop: 14, maxWidth: 360 }}>
                <label style={label}>Alert Email</label>
                <input type="email" style={inputStyle} value={form.alert_email ?? ""}
                  onChange={(e) => set("alert_email", e.target.value || null)} placeholder="ops@example.com" />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 720 }}>
              <button
                onClick={handleSave}
                disabled={saving || !dirty || !canEdit}
                title={canEdit ? undefined : "Requires SysAdmin role"}
                style={{
                  background: dirty && canEdit ? colors.blue : colors.bgCardHover, border: "none", borderRadius: 6,
                  padding: "10px 20px", color: dirty && canEdit ? "#fff" : colors.textSecondary,
                  fontWeight: 600, fontSize: 14, cursor: saving || !dirty || !canEdit ? "default" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8, opacity: saving ? 0.85 : 1,
                }}
              >
                {saving ? <Spinner size={14} /> : <Save size={15} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={handleReset}
                disabled={saving || !dirty}
                style={{
                  background: "none", border: `1px solid ${colors.border}`, borderRadius: 6,
                  padding: "10px 16px", color: colors.textSecondary, fontSize: 13,
                  cursor: !dirty ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: !dirty ? 0.5 : 1,
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
              {!canEdit && <span style={{ fontSize: 12, color: colors.textSecondary }}>Read-only — requires SysAdmin to edit</span>}
              {canEdit && dirty && <span style={{ fontSize: 12, color: colors.yellow }}>Unsaved changes</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
