import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import { apiUrl } from "../lib/api.js";

export default function AddPatient() {
  const { getAccessTokenSilently } = useAuth0();
  const [patientQuery, setPatientQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestingEmail, setRequestingEmail] = useState("");
  const [info, setInfo] = useState("");
  const [infoType, setInfoType] = useState("info");

  async function handleSearchPatient() {
    setInfo("");
    if (!patientQuery.trim()) {
      setInfoType("error");
      return setInfo("Please enter patient email or name.");
    }

    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/patients/search?q=${encodeURIComponent(patientQuery.trim())}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Patient lookup failed");
      const results = payload.results || [];
      setSearchResults(results);
      setInfoType(results.length ? "success" : "info");
      setInfo(results.length ? `Found ${results.length} patient(s).` : "No patients matched your search.");
    } catch (error) {
      setSearchResults([]);
      setInfoType("error");
      setInfo(error.message || "Patient lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendMatchRequest(patientEmail) {
    if (!patientEmail) return;
    setRequestingEmail(patientEmail);
    setInfo("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/doctor/match-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ patientEmail }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to send request");
      setInfoType("success");
      setInfo("Match request sent.");
      await handleSearchPatient();
    } catch (error) {
      setInfoType("error");
      setInfo(error.message || "Failed to send request");
    } finally {
      setRequestingEmail("");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card title="Add New Patient">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <input
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            placeholder="patient@example.com or patient name"
            className="rounded-xl px-3 py-2 bg-white/80 ring-1 ring-black/10 outline-none"
          />
          <button
            type="button"
            onClick={handleSearchPatient}
            disabled={loading}
            className="rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {searchResults.length ? (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            {searchResults.map((entry) => {
              const patientLinked = Boolean(entry.relation);
              const patientPending = Boolean(entry.pendingRequest);
              const patientEmail = entry.patient?.email || "";
              const busy = requestingEmail === patientEmail;

              return (
                <div key={patientEmail || entry.patient?.userId} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                  <div className="font-semibold text-slate-900">{entry.patient?.name || "Patient"}</div>
                  <div className="text-slate-600 break-all">{patientEmail}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {patientLinked
                      ? "Relationship already active"
                      : patientPending
                      ? "A request is already pending"
                      : "No relationship found"}
                  </div>

                  {!patientLinked && !patientPending ? (
                    <button
                      type="button"
                      onClick={() => sendMatchRequest(patientEmail)}
                      disabled={busy}
                      className="mt-3 rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busy ? "Sending..." : "Send Match Request"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {info ? (
          <div className={`mt-3 text-sm ${infoType === "error" ? "text-rose-300" : infoType === "success" ? "text-emerald-300" : "text-slate-300"}`}>
            {info}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
