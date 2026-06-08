import React, { useState } from "react";
import { UserCog, X } from "lucide-react";
import { colors } from "../styles/theme";
import { api, ManagedUser, Role } from "../api/client";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useToast } from "./Toast";
import { Spinner } from "./Spinner";

interface Props {
  user?: ManagedUser; // present => edit mode
  onClose: () => void;
  onSaved: () => void;
}

const ROLES: Role[] = ["SysAdmin", "BusinessOwner", "ReadOnly"];

const label: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" };
const inputStyle: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "9px 12px", color: colors.textPrimary, fontSize: 13, width: "100%", outline: "none",
};

export function UserModal({ user, onClose, onSaved }: Props) {
  const toast = useToast();
  const editing = !!user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "ReadOnly");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const dismiss = () => { if (!saving) onClose(); };
  useEscapeKey(dismiss);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateUser(user!.id, { name: name.trim(), role, password: password || undefined });
        toast.success(`Updated ${name}.`);
      } else {
        await api.createUser({ email: email.trim(), name: name.trim(), password, role });
        toast.success(`Created ${name}.`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={dismiss} style={{ position: "fixed", inset: 0, background: "rgba(1,4,9,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ background: "#161b22", border: `1px solid ${colors.border}`, borderRadius: 12, padding: 28, width: 440, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <UserCog size={22} color={colors.blue} />
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary }}>{editing ? "Edit User" : "Add User"}</div>
          </div>
          <button type="button" onClick={dismiss} disabled={saving} aria-label="Close" style={{ background: "none", border: "none", cursor: saving ? "default" : "pointer", color: colors.textSecondary, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Email {!editing && <span style={{ color: colors.red }}>*</span>}</label>
          <input type="email" value={email} disabled={editing} onChange={(e) => setEmail(e.target.value)} placeholder="user@vaultsync.io"
            style={{ ...inputStyle, opacity: editing ? 0.6 : 1, cursor: editing ? "not-allowed" : "text" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Name <span style={{ color: colors.red }}>*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Role <span style={{ color: colors.red }}>*</span></label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={label}>Password {editing ? <span style={{ color: colors.textMuted }}>(leave blank to keep)</span> : <span style={{ color: colors.red }}>*</span>}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editing ? "••••••••" : "min 6 characters"} style={inputStyle} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={dismiss} disabled={saving} style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "9px 18px", cursor: saving ? "default" : "pointer", color: colors.textSecondary, fontSize: 13 }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ background: colors.blue, border: "none", borderRadius: 6, padding: "9px 18px", cursor: saving ? "default" : "pointer", color: "#fff", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, opacity: saving ? 0.85 : 1 }}>
            {saving && <Spinner size={14} />}
            {saving ? "Saving…" : editing ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
