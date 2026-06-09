import React, { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Shield, LogIn } from "lucide-react";
import { colors } from "../styles/theme";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";

const inputStyle: React.CSSProperties = {
  background: "#010409", border: `1px solid ${colors.border}`, borderRadius: 6,
  padding: "10px 12px", color: colors.textPrimary, fontSize: 14, width: "100%", outline: "none",
};

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/";
  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in.");
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, background: colors.blue, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>Restora</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Backups, Proven Restorable</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary, marginBottom: 18 }}>Sign in</div>

          <label style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Email</label>
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restora.io" style={{ ...inputStyle, marginBottom: 14 }} />

          <label style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, display: "block" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...inputStyle, marginBottom: 22 }} />

          <button type="submit" disabled={busy || !email || !password} style={{
            width: "100%", background: !email || !password ? colors.bgCardHover : colors.blue,
            border: "none", borderRadius: 6, padding: "11px", color: !email || !password ? colors.textSecondary : "#fff",
            fontWeight: 600, fontSize: 14, cursor: busy || !email || !password ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.85 : 1,
          }}>
            {busy ? <Spinner size={15} /> : <LogIn size={16} />}
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
