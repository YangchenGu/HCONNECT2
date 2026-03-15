import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import { apiUrl } from "../lib/api.js";

export default function Notifications() {
  const { getAccessTokenSilently } = useAuth0();
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [pendingMatches, setPendingMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  async function loadNotifications() {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/doctor/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load notifications");
      setAppointmentRequests(payload.appointmentRequests || []);
      setPendingMatches(payload.pendingMatches || []);
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

  async function respondAppointment(appointmentId, action) {
    setBusyAppointmentId(appointmentId);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/appointments/${appointmentId}/respond`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to update appointment request");
      setMessageType("success");
      setMessage(action === "confirm" ? "Appointment confirmed." : "Appointment rejected.");
      await loadNotifications();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to update appointment request");
    } finally {
      setBusyAppointmentId(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <Card
        title="Pending Appointment Requests"
        right={
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          {appointmentRequests.length ? (
            appointmentRequests.map((item) => (
              <div key={item.AppointmentID} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="font-semibold text-slate-900">{item.patient_name || "Patient"}</div>
                <div className="text-xs text-slate-600 break-all">{item.patient_email}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {new Date(item.start_time).toLocaleString()} - {new Date(item.end_time).toLocaleTimeString()}
                </div>
                <div className="mt-1 text-xs text-slate-600">Reason: {item.reason || "-"}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busyAppointmentId === item.AppointmentID}
                    onClick={() => respondAppointment(item.AppointmentID, "confirm")}
                    className="rounded-xl px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyAppointmentId === item.AppointmentID}
                    onClick={() => respondAppointment(item.AppointmentID, "reject")}
                    className="rounded-xl px-3 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">No pending appointment requests.</div>
          )}
        </div>
      </Card>

      <Card title="Pending Match Requests">
        <div className="space-y-3 text-sm">
          {pendingMatches.length ? (
            pendingMatches.map((request) => (
              <div key={request.RequestID} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="font-semibold text-slate-900">{request.patient_name || "Patient"}</div>
                <div className="text-xs text-slate-600 break-all">{request.patient_email}</div>
                {request.message ? <div className="mt-1 text-xs text-slate-600">Message: {request.message}</div> : null}
                <div className="mt-1 text-xs text-slate-500">Waiting for patient response.</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">No pending match requests.</div>
          )}
        </div>
      </Card>

      {message ? (
        <div className={`text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div>
      ) : null}
    </div>
  );
}
