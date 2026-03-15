import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { apiUrl } from "../lib/api.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkedPatientsTotal, setLinkedPatientsTotal] = useState(0);
  const [pending, setPending] = useState({ appointmentRequests: 0, matchRequests: 0, adviceReceipts: 0 });
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [recentAdvices, setRecentAdvices] = useState([]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/doctor/dashboard"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load dashboard");

      setLinkedPatientsTotal(Number(payload.linkedPatientsTotal || 0));
      setPending(payload.pending || { appointmentRequests: 0, matchRequests: 0, adviceReceipts: 0 });
      setUpcomingAppointments(payload.upcomingAppointments || []);
      setRecentAdvices(payload.recentAdvices || []);
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [getAccessTokenSilently]);

  const totalPending = useMemo(
    () => Number(pending.appointmentRequests || 0) + Number(pending.matchRequests || 0) + Number(pending.adviceReceipts || 0),
    [pending]
  );

  function urgencyLabel(value) {
    const norm = String(value || "").toLowerCase();
    if (norm === "urgent") return "Urgent";
    if (norm === "low") return "Not Urgent";
    return "Normal";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Linked Patients" value={String(linkedPatientsTotal)} sub="Active relationships" />
        <KPI label="Pending Actions" value={String(totalPending)} sub="Needs attention" />
        <KPI label="Upcoming Appointments" value={String(upcomingAppointments.length)} sub="Next scheduled visits" />
        <KPI label="Status" value={loading ? "Syncing" : "Ready"} sub={error ? "Load issue detected" : "Dashboard is up to date"} />
      </div>

      <Card
        title="Quick Actions"
        right={
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/patients/new")}
            className="rounded-xl px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white"
          >
            Add New Patient
          </button>
          <button
            type="button"
            onClick={() => navigate("/appointments")}
            className="rounded-xl px-3 py-2 text-xs border border-slate-600 text-slate-100 hover:bg-slate-800"
          >
            Open Appointments
          </button>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="rounded-xl px-3 py-2 text-xs border border-slate-600 text-slate-100 hover:bg-slate-800"
          >
            Open Notifications
          </button>
        </div>
        {error ? <div className="mt-3 text-sm text-rose-300">{error}</div> : null}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Upcoming Appointments (Nearest)">
          <div className="space-y-2 text-sm">
            {upcomingAppointments.length ? (
              upcomingAppointments.map((item) => (
                <div key={item.AppointmentID} className="rounded-xl bg-[#1a2647] ring-1 ring-slate-700/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{item.patient_name || "Patient"}</div>
                      <div className="text-xs text-slate-400 break-all">{item.patient_email || ""}</div>
                    </div>
                    <span
                      className={
                        String(item.status).toLowerCase() === "pending"
                          ? "text-xs rounded-full bg-amber-500/20 text-amber-200 px-2 py-1"
                          : "text-xs rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-1"
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {new Date(item.start_time).toLocaleString()} - {new Date(item.end_time).toLocaleTimeString()}
                  </div>
                  {item.reason ? <div className="mt-1 text-xs text-slate-400">Reason: {item.reason}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">No upcoming appointments.</div>
            )}
          </div>
        </Card>

        <Card title="Pending Action Cards">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-300/20 p-3">
              <div className="text-xs text-amber-200/85">Appointment Requests</div>
              <div className="mt-1 text-2xl font-semibold text-amber-100">{pending.appointmentRequests || 0}</div>
            </div>
            <div className="rounded-xl bg-sky-500/10 ring-1 ring-sky-300/20 p-3">
              <div className="text-xs text-sky-200/85">Patient Match Requests</div>
              <div className="mt-1 text-2xl font-semibold text-sky-100">{pending.matchRequests || 0}</div>
            </div>
            <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-300/20 p-3">
              <div className="text-xs text-rose-200/85">Advice Pending Receipt</div>
              <div className="mt-1 text-2xl font-semibold text-rose-100">{pending.adviceReceipts || 0}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Recent Advice Receipt Status (Latest 5)">
        <div className="space-y-2 text-sm">
          {recentAdvices.length ? (
            recentAdvices.map((advice) => (
              <div key={advice.AdviceID} className="rounded-xl bg-[#1a2647] ring-1 ring-slate-700/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">{advice.patient_name || "Patient"}</div>
                    <div className="text-xs text-slate-400 break-all">{advice.patient_email || ""}</div>
                  </div>
                  <span
                    className={
                      advice.is_acknowledged
                        ? "text-xs rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-1"
                        : "text-xs rounded-full bg-amber-500/20 text-amber-200 px-2 py-1"
                    }
                  >
                    {advice.is_acknowledged ? "Received" : "Pending receipt"}
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-300">
                  Urgency: {urgencyLabel(advice.urgency)} | Sent: {new Date(advice.created_at).toLocaleString()}
                </div>

                {advice.is_acknowledged && advice.acknowledged_at ? (
                  <div className="mt-1 text-xs text-emerald-300/90">Acknowledged: {new Date(advice.acknowledged_at).toLocaleString()}</div>
                ) : null}

                <div className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">{advice.content}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">No advice records yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
