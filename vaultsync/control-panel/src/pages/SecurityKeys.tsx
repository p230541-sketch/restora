import React, { useEffect, useState } from "react";
import { Key, AlertTriangle, RefreshCw } from "lucide-react";
import { api, KeyData, AppSettings } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { EmergencyKeyModal } from "../components/EmergencyKeyModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { Spinner } from "../components/Spinner";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";

export function SecurityKeys() {
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const toast = useToast();
  const { hasRole } = useAuth();
  const canReveal = hasRole("SysAdmin");

  function loadSettings() {
    api.getSettings().then(setSettings).catch(() => {});
  }
  useEffect(() => { loadSettings(); }, []);

  const rotationRemaining = settings?.key_rotated_at
    ? Math.round(settings.key_rotation_days - (Date.now() - new Date(settings.key_rotated_at).getTime()) / 86400000)
    : null;
  const rotationValid = rotationRemaining == null || rotationRemaining > 0;

  function handleViewKey() {
    setLoading(true);
    api.getKey("VS-SYNC-PRIMARY-ALPHA-01")
      .then((k) => setKeyData(k))
      .catch(() => toast.error("Unable to retrieve the recovery key."))
      .finally(() => setLoading(false));
  }

  async function confirmRotate() {
    setRotating(true);
    try {
      await api.rotateKey();
      toast.success("Encryption key rotated. New backups use the new key.");
      setRotateOpen(false);
      loadSettings();
    } catch (err: any) {
      toast.error(err?.message ?? "Key rotation failed.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <TopBar />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Security Keys</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            Manage emergency decryption keys for disaster recovery.
          </div>
        </div>

        <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 24, maxWidth: 600 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
            <Key size={24} color={colors.yellow} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary }}>Primary Recovery Key</div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>ID: VS-SYNC-PRIMARY-ALPHA-01</div>
            </div>
            <div style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600,
              background: rotationValid ? colors.yellowDim : colors.redDim,
              color: rotationValid ? colors.yellow : colors.red,
            }}>
              {rotationRemaining == null
                ? "Loading…"
                : rotationValid
                ? `Valid — Expire ${rotationRemaining}d`
                : "Rotation overdue"}
            </div>
          </div>

          <div style={{ background: colors.orangeDim, border: `1px solid ${colors.orange}`, borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: colors.orange, fontWeight: 600 }}>
              <AlertTriangle size={14} />
              This key grants full data recovery access. Handle with extreme caution.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleViewKey}
              disabled={loading || !canReveal}
              title={canReveal ? undefined : "Requires SysAdmin role"}
              style={{ background: canReveal ? colors.blue : colors.bgCardHover, border: "none", borderRadius: 6, padding: "10px 20px", color: canReveal ? "#fff" : colors.textSecondary, fontWeight: 600, cursor: loading || !canReveal ? "default" : "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? 0.85 : 1 }}
            >
              {loading && <Spinner size={14} />}
              {loading ? "Loading..." : canReveal ? "View Emergency Decryption Key" : "Restricted — SysAdmin only"}
            </button>
            {canReveal && (
              <button
                onClick={() => setRotateOpen(true)}
                disabled={rotating}
                style={{ background: "none", border: `1px solid ${colors.orange}`, borderRadius: 6, padding: "10px 18px", color: colors.orange, fontWeight: 600, cursor: rotating ? "default" : "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {rotating ? <Spinner size={14} color={colors.orange} /> : <RefreshCw size={15} />}
                {rotating ? "Rotating…" : "Rotate Key Now"}
              </button>
            )}
          </div>
        </div>

        {keyData && <EmergencyKeyModal keyData={keyData} onClose={() => setKeyData(null)} />}
        {rotateOpen && (
          <ConfirmModal
            title="Rotate encryption key?"
            message={
              <>
                This generates a new AES-256 key and stores it in Secrets Manager. All <strong style={{ color: colors.textPrimary }}>new</strong> backups
                will be encrypted with it and the rotation clock resets to {settings?.key_rotation_days ?? 90} days.
                <br /><br />
                <span style={{ color: colors.orange }}>Note:</span> backups already encrypted with the previous key cannot be decrypted with the new one — keep the existing emergency key safe before rotating.
              </>
            }
            confirmLabel="Rotate Key"
            loading={rotating}
            onConfirm={confirmRotate}
            onClose={() => setRotateOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
