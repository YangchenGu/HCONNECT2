import React, { useMemo, useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";

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
import PatientEntry from "./pages/PatientEntry.jsx";
import PatientRegister from "./pages/PatientRegister.jsx";
import PatientSidebar from "./components/patient/PatientSidebar.jsx";
import PatientTopbar from "./components/patient/PatientTopbar.jsx";
import PatientDashboard from "./pages/patient/PatientDashboard.jsx";
import PatientHistory from "./pages/patient/PatientHistory.jsx";
import PatientReportForm from "./pages/patient/PatientReportForm.jsx";
import PatientAppointments from "./pages/patient/PatientAppointments.jsx";
import PatientAccount from "./pages/patient/PatientAccount.jsx";
import PatientNotifications from "./pages/patient/PatientNotifications.jsx";

import RoleSelection from "./pages/RoleSelection.jsx";
import VerifyWrapper from "./pages/VerifyWrapper.jsx";
import DoctorEntry from "./pages/DoctorEntry.jsx";
import RegisterWithPhone from "./pages/RegisterWithPhone.jsx";
import { apiUrl } from "./lib/api.js";

const APP_ORIGIN =
  import.meta.env.VITE_APP_ORIGIN ||
  (import.meta.env.DEV ? "http://localhost:5173" : window.location.origin);

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

function DashboardLayout({ user, logout, getAccessTokenSilently }) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const location = useLocation();

  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  useEffect(() => {
    const loadDoctorNotificationCount = async () => {
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/doctor/notifications"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = await res.json();
        const nextCount = (payload.appointmentRequests?.length || 0) + (payload.pendingMatches?.length || 0);
        setNotificationCount(nextCount);
      } catch {
        setNotificationCount(0);
      }
    };

    loadDoctorNotificationCount();
  }, [location.pathname, getAccessTokenSilently]);

  return (
    <div className="doctor-theme flex items-start min-h-screen bg-[linear-gradient(180deg,#1a1533_0%,#120f27_100%)] text-slate-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} user={user} logout={logout} />
      <div className="flex-1 min-h-screen overflow-x-hidden">
        <Topbar title={title} search={search} setSearch={setSearch} notificationCount={notificationCount} />

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function patientTitleFromPath(pathname) {
  if (pathname === "/") return "Patient Dashboard";
  if (pathname.startsWith("/patient/history")) return "My Health History";
  if (pathname.startsWith("/patient/report")) return "Daily Condition Report";
  if (pathname.startsWith("/patient/appointments")) return "Appointments";
  if (pathname.startsWith("/patient/notifications")) return "Notifications";
  if (pathname.startsWith("/patient/account")) return "Account Settings";
  return "Patient Dashboard";
}

function PatientLayout({ user, logout, getAccessTokenSilently }) {
  const location = useLocation();
  const [notificationCount, setNotificationCount] = useState(0);
  const title = useMemo(() => patientTitleFromPath(location.pathname), [location.pathname]);

  useEffect(() => {
    const loadPatientNotificationCount = async () => {
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/patient/notifications"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = await res.json();
        const nextCount = payload.incomingMatches?.length || 0;
        setNotificationCount(nextCount);
      } catch {
        setNotificationCount(0);
      }
    };

    loadPatientNotificationCount();
  }, [location.pathname, getAccessTokenSilently]);

  return (
    <div className="patient-theme flex items-start min-h-screen bg-[#0c1328]">
      <PatientSidebar user={user} logout={logout} />
      <div className="flex-1 min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#12203c_0%,#0d1730_100%)]">
        <PatientTopbar title={title} notificationCount={notificationCount} />

        <Routes>
          <Route path="/" element={<PatientDashboard />} />
          <Route path="/patient/history" element={<PatientHistory />} />
          <Route path="/patient/report" element={<PatientReportForm />} />
          <Route path="/patient/appointments" element={<PatientAppointments />} />
          <Route path="/patient/notifications" element={<PatientNotifications />} />
          <Route path="/patient/account" element={<PatientAccount />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading, user, logout, getAccessTokenSilently } = useAuth0();
  const [userRole, setUserRole] = useState(null);
  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      if (!user) {
        setUserRole(null);
        setRoleResolved(true);
        return;
      }

      if (!isAuthenticated) {
        setUserRole(null);
        setRoleResolved(true);
        return;
      }

      try {
        // Security: trust backend role source for authenticated users.
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
          localStorage.removeItem(`user_role_${user.sub}`);
        }
      } catch {
        setUserRole(null);
      } finally {
        setRoleResolved(true);
      }
    };

    setRoleResolved(false);
    loadRole();
  }, [user, isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#1a1533_0%,#120f27_100%)] flex items-center justify-center text-slate-300">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          <p className="mt-4 text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !roleResolved) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#1a1533_0%,#120f27_100%)] flex items-center justify-center text-slate-300">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          <p className="mt-4 text-slate-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  // no role chosen -> show selection/registration routes
  if (!userRole) {
    return (
      <Routes>
        <Route path="/patient/entry" element={<PatientEntry />} />
        <Route path="/patient/register" element={<PatientRegister />} />
        <Route path="/doctor/entry" element={<DoctorEntry />} />
        <Route path="/verify-phone" element={<VerifyWrapper />} />
        <Route path="/register" element={<RegisterWithPhone />} />
        <Route path="*" element={<RoleSelection />} />
      </Routes>
    );
  }

  // user logged in and role selected -> show dashboard
  const effectiveUser = user || {
    name: "User",
    email: "user@localhost",
  };

  const effectiveLogout = () => logout({ logoutParams: { returnTo: APP_ORIGIN } });

  if (userRole === "patient") {
    return <PatientLayout user={effectiveUser} logout={effectiveLogout} getAccessTokenSilently={getAccessTokenSilently} />;
  }

  return <DashboardLayout user={effectiveUser} logout={effectiveLogout} getAccessTokenSilently={getAccessTokenSilently} />;
}