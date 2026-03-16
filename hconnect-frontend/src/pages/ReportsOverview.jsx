import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import { apiUrl } from "../lib/api.js";

const METRIC_ORDER = [
  "Blood Pressure Systolic",
  "Blood Pressure Diastolic",
  "Weight",
  "Sleep Duration",
  "Sleep Quality",
  "Pain Level",
];

function sortAverages(rows) {
  return [...rows].sort((a, b) => {
    const ai = METRIC_ORDER.indexOf(a.metric_name);
    const bi = METRIC_ORDER.indexOf(b.metric_name);
    if (ai === -1 && bi === -1) return String(a.metric_name || "").localeCompare(String(b.metric_name || ""));
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function ReportsOverview() {
  const navigate = useNavigate();
  const { getAccessTokenSilently } = useAuth0();
  const [patients, setPatients] = useState([]);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [averagesMap, setAveragesMap] = useState({});
  const [loadingAverages, setLoadingAverages] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      setError("");
      setExpandedPatientId(null);
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/doctor/reports/patients"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load report overview");
        setPatients(payload.patients || []);
      } catch (err) {
        setError(err.message || "Failed to load report overview");
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, [getAccessTokenSilently]);

  const stats = useMemo(() => {
    const withReports = patients.filter((p) => p.last_report_at).length;
    return {
      totalPatients: patients.length,
      withReports,
      withoutReports: Math.max(0, patients.length - withReports),
    };
  }, [patients]);

  async function loadAverages(patientId) {
    if (averagesMap[patientId] || loadingAverages[patientId]) return;

    setLoadingAverages((prev) => ({ ...prev, [patientId]: true }));
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/reports/patients/${patientId}/averages`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load patient averages");
      setAveragesMap((prev) => ({ ...prev, [patientId]: sortAverages(payload.averages || []) }));
    } catch (err) {
      setAveragesMap((prev) => ({
        ...prev,
        [patientId]: [{ metric_name: "Error", metric_unit: "", avg_value: err.message || "Failed to load" }],
      }));
    } finally {
      setLoadingAverages((prev) => ({ ...prev, [patientId]: false }));
    }
  }

  function onRowClick(patientId) {
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null);
      return;
    }
    setExpandedPatientId(patientId);
    loadAverages(patientId);
  }

  return (
    <div className="p-6 space-y-4 text-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-4">
          <div className="text-xs text-violet-300/80">Linked patients</div>
          <div className="mt-1 text-2xl font-semibold text-white">{stats.totalPatients}</div>
        </div>
        <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-4">
          <div className="text-xs text-violet-300/80">Patients with reports</div>
          <div className="mt-1 text-2xl font-semibold text-white">{stats.withReports}</div>
        </div>
        <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-4">
          <div className="text-xs text-violet-300/80">No reports yet</div>
          <div className="mt-1 text-2xl font-semibold text-white">{stats.withoutReports}</div>
        </div>
      </div>

      <Card title="Patient Report Overview" right={<span className="text-xs text-slate-400">Click row: expand/collapse. Use the expanded button to open detail page.</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700/50">
                <th className="py-2 pr-3 font-medium">Patient</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Last report</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-300">Loading patient reports...</td>
                </tr>
              ) : null}

              {!loading && error ? (
                <tr>
                  <td colSpan={3} className="py-4 text-rose-300">{error}</td>
                </tr>
              ) : null}

              {!loading && !error && !patients.length ? (
                <tr>
                  <td colSpan={3} className="py-4 text-slate-300">No linked patients found.</td>
                </tr>
              ) : null}

              {!loading && !error
                ? patients.map((patient) => {
                    const patientId = patient.patient_id;
                    const expanded = expandedPatientId === patientId;
                    const averages = averagesMap[patientId] || [];
                    const rowLoading = Boolean(loadingAverages[patientId]);

                    return (
                      <React.Fragment key={patientId}>
                        <tr
                          onClick={() => onRowClick(patientId)}
                          className="border-b border-slate-700/30 hover:bg-violet-900/20 cursor-pointer"
                        >
                          <td className="py-3 pr-3 text-white font-medium">{patient.patient_name || "Patient"}</td>
                          <td className="py-3 pr-3 text-slate-300">{patient.patient_email || "-"}</td>
                          <td className="py-3 pr-3 text-slate-300">
                            {patient.last_report_at ? new Date(patient.last_report_at).toLocaleString() : "No report"}
                          </td>
                        </tr>

                        {expanded ? (
                          <tr className="border-b border-slate-700/30">
                            <td colSpan={3} className="py-3">
                              <div className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3 space-y-3">
                                <div className="text-xs text-violet-300/85">7-day averages for this patient</div>

                                {rowLoading ? <div className="text-sm text-slate-300">Loading averages...</div> : null}

                                {!rowLoading && averages.length ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {averages.map((avg) => (
                                      <div key={`${patientId}-${avg.metric_name}`} className="rounded-lg border border-violet-300/10 px-3 py-2">
                                        <div className="text-xs text-violet-300/80">{avg.metric_name}</div>
                                        <div className="mt-1 text-sm text-white font-semibold">
                                          {avg.avg_value}
                                          {avg.metric_unit ? ` ${avg.metric_unit}` : ""}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {!rowLoading && !averages.length ? (
                                  <div className="text-sm text-slate-300">No 7-day data for this patient.</div>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/reports/detail?patientId=${patientId}`);
                                  }}
                                  className="rounded-xl bg-violet-500 hover:bg-violet-400 text-white px-3 py-2 text-xs font-semibold"
                                >
                                  Open detailed history
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
