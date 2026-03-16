import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { apiUrl } from "../lib/api.js";

export default function Patients() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const [relationData, setRelationData] = useState({ pending: [], linked: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyPatientId, setBusyPatientId] = useState(null);
  const [confirmingPatient, setConfirmingPatient] = useState(null);
  const [info, setInfo] = useState("");
  const [infoType, setInfoType] = useState("success");

  const filteredLinked = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return relationData.linked;
    return relationData.linked.filter((p) =>
      [p.patient_name, p.patient_email].some((x) => String(x || "").toLowerCase().includes(q))
    );
  }, [search, relationData.linked]);

  async function fetchDoctorMatchState() {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/doctor/match-requests"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load relationship state");
      setRelationData({ pending: payload.pending || [], linked: payload.linked || [] });
      setInfoType("success");
      setInfo("");
    } catch (error) {
      setInfoType("error");
      setInfo(error.message || "Failed to load relationship state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDoctorMatchState();
  }, [isAuthenticated]);

  async function removeRelationship() {
    if (!confirmingPatient?.patient_id) return;

    setBusyPatientId(confirmingPatient.patient_id);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/patients/${confirmingPatient.patient_id}/relation`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to remove relationship");

      setInfoType("success");
      setInfo(`Relationship removed for ${confirmingPatient.patient_name || "patient"}.`);
      setConfirmingPatient(null);
      await fetchDoctorMatchState();
    } catch (error) {
      setInfoType("error");
      setInfo(error.message || "Failed to remove relationship");
    } finally {
      setBusyPatientId(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <KPI label="Linked Patients" value={String(relationData.linked.length)} />
        <KPI label="Pending Requests" value={String(relationData.pending.length)} />
        <KPI label="Visible" value={String(filteredLinked.length)} />
        <KPI label="Status" value={loading ? "Syncing" : "Ready"} />
      </div>

      <Card
        title="Patient List (Linked Only)"
        right={
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
              <span className="text-slate-500">🔎</span>
              <input
                className="outline-none text-sm w-56 bg-transparent text-slate-900 placeholder:text-slate-500"
                placeholder="Search patient name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <a href="/patients/new" className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800">
              + Add
            </a>
          </div>
        }
      >
        <div className="mb-3 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
            <span className="text-slate-500">🔎</span>
            <input
              className="outline-none text-sm w-full bg-transparent text-slate-900 placeholder:text-slate-500"
              placeholder="Search patient name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Relationship Since</th>
                <th className="py-2 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinked.map((p) => (
                <tr key={p.RelationID} className="border-b last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-slate-900">{p.patient_name || "Patient"}</div>
                    <div className="text-xs text-slate-500">{p.patient_email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        String(p.status).toLowerCase() === "active"
                          ? "text-xs rounded-full bg-sky-100 text-sky-800 px-2 py-1"
                          : "text-xs rounded-full bg-slate-200 text-slate-700 px-2 py-1"
                      }
                    >
                      {String(p.status || "unknown")}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!p.patient_id}
                        onClick={() => navigate(`/reports/detail?patientId=${p.patient_id}`)}
                        className="rounded-xl px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                      >
                        View detailed report
                      </button>
                      <button
                        type="button"
                        disabled={!p.patient_id || busyPatientId === p.patient_id}
                        onClick={() =>
                          setConfirmingPatient({
                            patient_id: p.patient_id,
                            patient_name: p.patient_name || "Patient",
                            patient_email: p.patient_email || "",
                          })
                        }
                        className="rounded-xl px-3 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                      >
                        {busyPatientId === p.patient_id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLinked.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No linked patients yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {info ? (
          <div className={`mt-3 text-sm ${infoType === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {info}
          </div>
        ) : null}
      </Card>

      {confirmingPatient ? (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-300/30 bg-[#1b1834] p-5 text-violet-100 shadow-2xl">
            <h3 className="text-base font-semibold text-white">Confirm relationship removal</h3>
            <p className="mt-2 text-sm text-violet-200/90">
              You are about to remove the doctor-patient relationship with <span className="font-semibold text-white">{confirmingPatient.patient_name}</span>.
            </p>
            <p className="mt-1 text-xs text-violet-300/85 break-all">{confirmingPatient.patient_email}</p>
            <p className="mt-3 text-xs text-rose-200/90">This helps prevent accidental removal. Please confirm this action.</p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingPatient(null)}
                disabled={Boolean(busyPatientId)}
                className="rounded-xl border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 text-violet-100 px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={removeRelationship}
                disabled={Boolean(busyPatientId)}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busyPatientId ? "Removing..." : "Yes, remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
