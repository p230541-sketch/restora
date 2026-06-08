import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { EdgeNodes } from "./pages/EdgeNodes";
import { NodeDetail } from "./pages/NodeDetail";
import { SecurityKeys } from "./pages/SecurityKeys";
import { Settings } from "./pages/Settings";
import { Users } from "./pages/Users";
import { Alerts } from "./pages/Alerts";
import { Audit } from "./pages/Audit";
import { Spinner } from "./components/Spinner";
import { colors } from "./styles/theme";
import { Role } from "./api/client";

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={22} color={colors.textSecondary} />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: colors.bg }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nodes" element={<EdgeNodes />} />
          <Route path="/nodes/:id" element={<NodeDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/keys" element={<SecurityKeys />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/users" element={<RequireRole role="SysAdmin"><Users /></RequireRole>} />
          <Route path="/audit" element={<RequireRole role="SysAdmin"><Audit /></RequireRole>} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
