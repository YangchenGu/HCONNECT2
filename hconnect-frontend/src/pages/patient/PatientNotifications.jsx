import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

export default function PatientNotifications() {
  const { getAccessTokenSilently } = useAuth0();
  const [incomingMatches, setIncomingMatches] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  async function loadNotifications() {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load notifications");
      setIncomingMatches(payload.incomingMatches || []);
      setAppointments(payload.appointments || []);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function respondMatchRequest(requestId, action) {
    setBusyRequestId(requestId);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/patient/match-requests/${requestId}/respond`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to respond to request");
      setMessageType("success");
      setMessage(action === "accept" ? "Doctor request accepted." : "Doctor request rejected.");
      await loadNotifications();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to respond to request");
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="p-6 text-violet-100 space-y-4">
      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Connection Requests</h2>
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading || Boolean(busyRequestId)}
            className="rounded-lg border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {incomingMatches.length ? (
            incomingMatches.map((r) => {
              const busy = busyRequestId === r.RequestID;
              return (
                <div key={r.RequestID} className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3 text-sm">
                  <div className="font-semibold text-white">{r.doctor_name || "Doctor"}</div>
                  <div className="text-xs text-violet-300/90 break-all">{r.doctor_email}</div>
                  {r.message ? <div className="mt-1 text-xs text-violet-200/90">Message: {r.message}</div> : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respondMatchRequest(r.RequestID, "accept")}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs text-white"
                    >
                      {busy ? "Working..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respondMatchRequest(r.RequestID, "reject")}
                      className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-3 py-1.5 text-xs text-white"
                    >
                      {busy ? "Working..." : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-violet-300/80">No pending connection requests.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">Appointment Updates</h2>
        <div className="mt-3 space-y-2">
          {appointments.length ? (
            appointments.map((a) => (
              <div key={a.AppointmentID} className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3 text-sm">
                <div className="font-semibold text-white">{a.doctor_name || "Doctor"}</div>
                <div className="text-xs text-violet-300/90">Status: {a.status}</div>
                <div className="text-xs text-violet-300/90">
                  Slot: {new Date(a.start_time).toLocaleString()} - {new Date(a.end_time).toLocaleTimeString()}
                </div>
                <div className="mt-1 text-xs text-violet-200/85">Reason: {a.reason}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-violet-300/80">No appointment notifications yet.</div>
          )}
        </div>
      </div>

      {message ? <div className={`text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div> : null}
    </div>
  );
}
