import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

const METRIC_DEFS = [
  { name: "Blood Pressure Systolic", label: "Avg Systolic BP (7d)", unit: "mmHg" },
  { name: "Blood Pressure Diastolic", label: "Avg Diastolic BP (7d)", unit: "mmHg" },
  { name: "Weight", label: "Avg Weight (7d)", unit: "kg" },
  { name: "Sleep Duration", label: "Avg Sleep Duration (7d)", unit: "hours" },
  { name: "Sleep Quality", label: "Avg Sleep Quality (7d)", unit: "score" },
  { name: "Pain Level", label: "Avg Pain Level (7d)", unit: "score" },
];

function average(values) {
  if (!values.length) return null;
  const total = values.reduce((sum, item) => sum + item, 0);
  return total / values.length;
}

function formatAvg(value, unit) {
  if (value === null || Number.isNaN(value)) return "No data";
  const fixed = value % 1 === 0 ? String(value) : value.toFixed(1);
  return unit ? `${fixed} ${unit}` : fixed;
}

function appointmentDisplayName(appointment) {
  const display = String(appointment?.doctor_display_name || "").trim();
  if (display) return display;
  const name = String(appointment?.doctor_name || "").trim();
  if (name) return name;
  return "Doctor";
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError("");
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const [reportsRes, appointmentsRes] = await Promise.all([
          fetch(apiUrl("/api/patient/reports?limit=500"), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(apiUrl("/api/patient/appointments"), {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const reportsPayload = await reportsRes.json().catch(() => ({}));
        const appointmentsPayload = await appointmentsRes.json().catch(() => ({}));

        if (!reportsRes.ok) throw new Error(reportsPayload.error || "Failed to load health metrics");
        if (!appointmentsRes.ok) throw new Error(appointmentsPayload.error || "Failed to load appointments");

        setRecords(reportsPayload.records || []);
        setAppointments(appointmentsPayload.appointments || []);
      } catch (err) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [getAccessTokenSilently]);

  const averageCards = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filtered = records.filter((row) => {
      const time = new Date(row.recorded_at);
      return !Number.isNaN(time.getTime()) && time >= sevenDaysAgo;
    });

    return METRIC_DEFS.map((metric) => {
      const values = filtered
        .filter((row) => String(row.metric_name || "").toLowerCase() === metric.name.toLowerCase())
        .map((row) => Number(row.value))
        .filter((value) => Number.isFinite(value));

      return {
        label: metric.label,
        value: formatAvg(average(values), metric.unit),
        note: `${values.length} record${values.length === 1 ? "" : "s"} in last 7 days`,
      };
    });
  }, [records]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((item) => {
        const status = String(item.status || "").toLowerCase();
        const start = new Date(item.start_time);
        return ["pending", "confirmed"].includes(status) && !Number.isNaN(start.getTime()) && start > now;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] || null;
  }, [appointments]);

  return (
    <div className="p-6 space-y-6 text-violet-100">
      <section>
        <h2 className="text-base font-semibold text-white">7-day metric averages</h2>
        <p className="mt-1 text-sm text-violet-300/80">Average values from your recent health reports.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {averageCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-violet-300/15 bg-violet-900/40 p-4">
              <div className="text-xs text-violet-300/80">{card.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{card.value}</div>
              <div className="mt-2 text-xs text-violet-300/70">{card.note}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">Upcoming appointment</h2>
        <p className="mt-1 text-sm text-violet-300/80">Your nearest upcoming visit with a linked doctor.</p>

        <button
          type="button"
          onClick={() => navigate("/patient/appointments")}
          className="mt-4 w-full text-left rounded-xl bg-[#211742] p-4 border border-violet-300/10 hover:bg-[#2a1d55] transition"
        >
          {nextAppointment ? (
            <>
              <div className="text-sm text-violet-200">{appointmentDisplayName(nextAppointment)}</div>
              <div className="mt-2 text-xl text-white font-semibold">{new Date(nextAppointment.start_time).toLocaleString()}</div>
              <div className="mt-1 text-xs text-violet-300/80">
                Status: {nextAppointment.status} | Click to open appointments
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-violet-200">No upcoming appointment found</div>
              <div className="mt-1 text-xs text-violet-300/80">Click to view and book appointments</div>
            </>
          )}
        </button>
      </section>

      {loading ? <div className="text-sm text-violet-300/80">Loading dashboard data...</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
    </div>
  );
}
