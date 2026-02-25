import React, { useMemo, useState } from "react";
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

function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();

  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  return (
    <div className="flex bg-slate-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
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
  const { isAuthenticated, isLoading } = useAuth0();

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

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <DashboardLayout />;
}