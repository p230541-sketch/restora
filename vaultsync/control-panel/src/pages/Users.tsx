import React, { useEffect, useState } from "react";
import { UserPlus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { api, ManagedUser, Role } from "../api/client";
import { colors } from "../styles/theme";
import { TopBar } from "../components/TopBar";
import { Spinner } from "../components/Spinner";
import { UserModal } from "../components/UserModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth/AuthContext";

const ROLE_COLOR: Record<Role, string> = {
  SysAdmin: colors.blue,
  BusinessOwner: colors.yellow,
  ReadOnly: colors.textSecondary,
};

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 12, fontWeight: 600, color: colors.textSecondary, textAlign: "left", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "12px 12px", fontSize: 13, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderMuted}` };

function formatTs(ts: string | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.listUsers().then(setUsers).catch(() => toast.error("Could not load users.")).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteUser(deleting.id);
      toast.success(`Deleted ${deleting.name}.`);
      setDeleting(null);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <TopBar title="Users" />
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>User Management</div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {users.length} account{users.length !== 1 ? "s" : ""} · roles control access across the platform.
            </div>
          </div>
          <button onClick={() => setAdding(true)} style={{ background: colors.blue, border: "none", borderRadius: 6, padding: "9px 16px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <UserPlus size={15} /> Add User
          </button>
        </div>

        {loading ? (
          <div style={{ color: colors.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
            <Spinner size={14} color={colors.textSecondary} /> Loading users…
          </div>
        ) : (
          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={th}>Last Login</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {u.name}
                      {me?.id === u.id && <span style={{ marginLeft: 8, fontSize: 11, color: colors.textMuted }}>(you)</span>}
                    </td>
                    <td style={{ ...td, color: colors.textSecondary, fontFamily: "monospace" }}>{u.email}</td>
                    <td style={td}>
                      <span style={{ padding: "3px 9px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: ROLE_COLOR[u.role], background: colors.bgCardHover, border: `1px solid ${ROLE_COLOR[u.role]}` }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ ...td, color: colors.textSecondary }}>{formatTs(u.last_login)}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button title="Edit" onClick={() => setEditing(u)} style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "5px 9px", cursor: "pointer", color: colors.textSecondary }}>
                          <Pencil size={14} />
                        </button>
                        <button title="Delete" onClick={() => setDeleting(u)} disabled={me?.id === u.id}
                          style={{ background: colors.bgCardHover, border: `1px solid ${colors.border}`, borderRadius: 4, padding: "5px 9px", cursor: me?.id === u.id ? "not-allowed" : "pointer", color: me?.id === u.id ? colors.textMuted : colors.red, opacity: me?.id === u.id ? 0.5 : 1 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <UserModal onClose={() => setAdding(false)} onSaved={load} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {deleting && (
        <ConfirmModal
          title="Delete user?"
          message={
            <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ShieldAlert size={16} color={colors.red} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Permanently remove <strong style={{ color: colors.textPrimary }}>{deleting.name}</strong> ({deleting.email})? They will lose all access immediately.</span>
            </span>
          }
          confirmLabel="Delete User"
          loading={busy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
