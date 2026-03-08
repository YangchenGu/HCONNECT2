import React, { useMemo, useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import LoginPage from "./pages/LoginPage.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import AddPatient from "./pages/AddPatient.jsx";
import Notifications from "./pages/Notifications.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import ReportsOverview from "./pages/ReportsOverview.jsx";
import ReportsDetailed from "./pages/ReportsDetailed.jsx";
import AccountSettings from "./pages/AccountSettings.jsx";
import NotificationSettings from "./pages/NotificationSettings.jsx";
import ProfileCustomization from "./pages/ProfileCustomization.jsx";
import Help from "./pages/Help.jsx";

import RoleSelection from "./pages/RoleSelection.jsx";
import VerifyWrapper from "./pages/VerifyWrapper.jsx";
import DoctorEntry from "./pages/DoctorEntry.jsx";
import RegisterWithPhone from "./pages/RegisterWithPhone.jsx";
import { apiUrl } from "./lib/api.js";

const DEMO_MODE_KEY = "hconnect_demo_mode";
const DEMO_ROLE_KEY = "hconnect_demo_role";

function titleFromPath(pathname) {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/patients/new")) return "Add New Patient";
  if (pathname.startsWith("/patients")) return "Patient List";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/reports/overview")) return "Reports — Overview";
  if (pathname.startsWith("/reports/detail")) return "Reports — Detailed report";
  if (pathname.startsWith("/settings/account")) return "Account Settings";
  if (pathname.startsWith("/settings/notifications")) return "Notification Settings";
  if (pathname.startsWith("/settings/profile")) return "Profile customization";
  if (pathname.startsWith("/help")) return "Help";
  return "Dashboard";
}

function DashboardLayout({ user, logout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();

  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  return (
    <div className="flex bg-slate-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} user={user} logout={logout} />
      <div className="flex-1 min-h-screen">
        <Topbar title={title} search={search} setSearch={setSearch} />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients search={search} />} />
          <Route path="/patients/new" element={<AddPatient />} />
          <Route path="/notifications" element={<Notifications />} />

          {/* ✅ Completed page (no longer placeholder) */}
          <Route path="/reports/overview" element={<ReportsOverview />} />
          <Route path="/reports/detail" element={<ReportsDetailed />} />

          <Route path="/settings/account" element={<AccountSettings />} />
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          <Route path="/settings/profile" element={<ProfileCustomization />} />

          <Route path="/help" element={<Help />} />
          <Route path="*" element={<Placeholder title="Not Found" hint="This route does not exist." />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading, user, logout, getAccessTokenSilently } = useAuth0();
  const [userRole, setUserRole] = useState(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem(DEMO_MODE_KEY) === "true");

  useEffect(() => {
    const onStorage = () => setDemoMode(localStorage.getItem(DEMO_MODE_KEY) === "true");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      if (demoMode) {
        setUserRole(localStorage.getItem(DEMO_ROLE_KEY) || "doctor");
        setRoleResolved(true);
        return;
      }

      if (!user) {
        setUserRole(null);
        setRoleResolved(true);
        return;
      }

      const savedRole = localStorage.getItem(`user_role_${user.sub}`);
      if (savedRole) {
        setUserRole(savedRole);
        setRoleResolved(true);
        return;
      }

      if (!isAuthenticated) {
        setUserRole(null);
        setRoleResolved(true);
        return;
      }

      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/me/role"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setUserRole(null);
          setRoleResolved(true);
          return;
        }
        const payload = await res.json();
        if (payload?.role) {
          setUserRole(payload.role);
          localStorage.setItem(`user_role_${user.sub}`, payload.role);
        } else {
          setUserRole(null);
        }
      } catch {
        setUserRole(null);
      } finally {
        setRoleResolved(true);
      }
    };

    setRoleResolved(false);
    loadRole();
  }, [user, isAuthenticated, getAccessTokenSilently, demoMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !roleResolved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  // no role chosen -> show selection/registration routes
  if (!userRole) {
    return (
      <Routes>
        <Route path="/doctor/entry" element={<DoctorEntry />} />
        <Route path="/verify-phone" element={<VerifyWrapper />} />
        <Route path="/register" element={<RegisterWithPhone />} />
        <Route path="*" element={<RoleSelection />} />
      </Routes>
    );
  }

  // user logged in and role selected -> show dashboard
  const effectiveUser = user || {
    name: "Demo User",
    email: "demo@hconnect.space",
  };

  const effectiveLogout = demoMode
    ? () => {
        localStorage.removeItem(DEMO_MODE_KEY);
        localStorage.removeItem(DEMO_ROLE_KEY);
        window.location.href = "/";
      }
    : logout;

  return <DashboardLayout user={effectiveUser} logout={effectiveLogout} />;
}