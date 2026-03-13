import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { apiUrl } from "../lib/api.js";

export default function Patients({ search }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [relationData, setRelationData] = useState({ pending: [], linked: [] });
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [infoType, setInfoType] = useState("success");

  const filteredLinked = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return relationData.linked;
    return relationData.linked.filter((p) =>
      [p.patient_name, p.patient_email, p.status].some((x) => String(x || "").toLowerCase().includes(q))
    );
  }, [search, relationData.linked]);

  async function fetchDoctorMatchState() {
    if (!isAuthenticated) return;
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
    }
  }

  useEffect(() => {
    fetchDoctorMatchState();
  }, [isAuthenticated]);

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
          <a href="/patients/new" className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800">
            + Add
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Relationship Since</th>
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
                </tr>
              ))}

              {filteredLinked.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
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
    </div>
  );
}
