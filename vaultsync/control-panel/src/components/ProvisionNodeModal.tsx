import React, { useState } from "react";
import { Server, X, Copy, CheckCircle } from "lucide-react";
import { colors } from "../styles/theme";
import { api, NodeRecord } from "../api/client";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

interface Props {
  onClose: () => void;
  onProvisioned: (node: NodeRecord) => void;
}

const NODE_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/i;

const label: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" };
const inputStyle: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "9px 12px", color: colors.textPrimary, fontSize: 13, width: "100%", outline: "none",
};

export function ProvisionNodeModal({ onClose, onProvisioned }: Props) {
  const toast = useToast();
  const [nodeId, setNodeId] = useState("");
  const [ip, setIp] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<NodeRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const dismiss = () => { if (!saving) onClose(); };
  useEscapeKey(dismiss);

  const valid = NODE_ID_RE.test(nodeId.trim());

  const installSnippet = created
    ? `docker run -d --name vaultsyncd-${created.node_id} \\
  -e NODE_ID=${created.node_id} \\
  -e NODE_IP=${created.ip_address ?? "auto"} \\
  -e S3_BUCKET=vaultsync-backups \\
  -e SECRET_ID=vaultsync/aes-key \\
  vaultsync/edge-node:latest`
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      toast.warning("Enter a valid node ID (2–63 chars: letters, digits, hyphens).");
      return;
    }
    setSaving(true);
    try {
      const node = await api.provisionNode(nodeId.trim(), ip.trim() || undefined);
      setCreated(node);
      onProvisioned(node);
      toast.success(`Node "${node.node_id}" provisioned.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to provision node.");
    } finally {
      setSaving(false);
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Install command copied.");
    } catch {
      toast.error("Could not access clipboard.");
    }
  }

  return (
    <div onClick={dismiss} style={{ position: "fixed", inset: 0, background: "rgba(1,4,9,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#161b22", border: `1px solid ${colors.border}`, borderRadius: 12, padding: 28, width: 480, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Server size={22} color={colors.blue} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>
                {created ? "Node Provisioned" : "Provision New Node"}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {created ? "Deploy the daemon to bring it online." : "Register an edge node in the backup mesh."}
              </div>
            </div>
          </div>
          <button onClick={dismiss} disabled={saving} aria-label="Close" style={{ background: "none", border: "none", cursor: saving ? "default" : "pointer", color: colors.textSecondary, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {!created ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Node ID <span style={{ color: colors.red }}>*</span></label>
              <input autoFocus value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="eu-west-prod-02" style={inputStyle} />
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>2–63 chars: letters, digits, hyphens.</div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={label}>IP Address <span style={{ color: colors.textMuted }}>(optional)</span></label>
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.42" style={inputStyle} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={dismiss} disabled={saving} style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "9px 18px", cursor: saving ? "default" : "pointer", color: colors.textSecondary, fontSize: 13 }}>
                Cancel
              </button>
              <button type="submit" disabled={saving || !valid} style={{ background: valid ? colors.blue : colors.bgCardHover, border: "none", borderRadius: 6, padding: "9px 18px", cursor: saving || !valid ? "default" : "pointer", color: valid ? "#fff" : colors.textSecondary, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, opacity: saving ? 0.85 : 1 }}>
                {saving && <Spinner size={14} />}
                {saving ? "Provisioning…" : "Provision Node"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ background: colors.greenDim, border: `1px solid ${colors.greenMid}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle size={16} color={colors.green} />
              <span style={{ fontSize: 13, color: colors.textPrimary }}>
                <strong>{created.node_id}</strong> registered. Run this on the target host:
              </span>
            </div>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <pre style={{ background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "14px", fontSize: 12, color: colors.green, fontFamily: "monospace", overflowX: "auto", margin: 0, whiteSpace: "pre" }}>
                {installSnippet}
              </pre>
              <button onClick={copySnippet} title="Copy" style={{ position: "absolute", top: 8, right: 8, background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "4px 8px", cursor: "pointer", color: copied ? colors.green : colors.textSecondary, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <Copy size={12} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ background: colors.blue, border: "none", borderRadius: 6, padding: "9px 18px", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
