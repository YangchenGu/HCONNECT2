import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import { apiUrl } from "../lib/api.js";

function formatLocalDateOnly(value) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateOptions() {
  const now = new Date();
  const options = [];
  for (let i = 1; i <= 8; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    options.push(formatLocalDateOnly(d));
  }
  return options;
}

export default function DoctorAppointments() {
  const { getAccessTokenSilently } = useAuth0();
  const [confirmedAppointments, setConfirmedAppointments] = useState([]);
  const [editableDates, setEditableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [daySlots, setDaySlots] = useState([]);
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [pendingModal, setPendingModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [busyAppointmentId, setBusyAppointmentId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  function initializeAvailability(slots) {
    const next = {};
    slots.forEach((slot) => {
      next[slot.SlotID] = Boolean(slot.is_available);
    });
    setAvailabilityMap(next);
  }

  async function loadDoctorAppointments() {
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/doctor/appointments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load appointments");
      setConfirmedAppointments((payload.appointments || []).filter((item) => item.status === "confirmed"));
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load appointments");
    }
  }

  async function loadDaySlots(dateValue) {
    if (!dateValue) return;
    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/doctor/appointment-slots?date=${encodeURIComponent(dateValue)}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load day slots");
      const slots = payload.slots || [];
      setDaySlots(slots);
      initializeAvailability(slots);
      if (Array.isArray(payload.editableWindow) && payload.editableWindow.length) {
        setEditableDates(payload.editableWindow);
        if (!payload.editableWindow.includes(dateValue)) {
          setSelectedDate(payload.editableWindow[0]);
        }
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load day slots");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const options = buildDateOptions();
    setEditableDates(options);
    setSelectedDate(options[0] || "");
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    loadDoctorAppointments();
    loadDaySlots(selectedDate);
  }, [selectedDate]);

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
      setPendingModal(null);
      await Promise.all([loadDoctorAppointments(), loadDaySlots(selectedDate)]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to update appointment request");
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function slotState(slot) {
    if (slot.appointment_status === "confirmed") return "confirmed";
    if (slot.appointment_status === "pending") return "pending";
    const isAvailable = Boolean(availabilityMap[slot.SlotID]);
    return isAvailable ? "available" : "unavailable";
  }

  function slotLabelClass(state) {
    if (state === "confirmed") return "bg-emerald-600 text-white";
    if (state === "pending") return "bg-amber-500 text-slate-900";
    if (state === "unavailable") return "bg-slate-600 text-slate-100";
    return "bg-sky-600 text-white";
  }

  function onSlotClick(slot) {
    const state = slotState(slot);
    if (state === "confirmed") return;
    if (state === "pending") {
      setPendingModal(slot);
      return;
    }

    setAvailabilityMap((prev) => ({
      ...prev,
      [slot.SlotID]: !Boolean(prev[slot.SlotID]),
    }));
  }

  async function saveDayAvailability() {
    if (!selectedDate || !daySlots.length) return;
    setSavingDay(true);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const payload = {
        date: selectedDate,
        slots: daySlots.map((slot) => ({
          slotId: slot.SlotID,
          isAvailable: Boolean(availabilityMap[slot.SlotID]),
        })),
      };
      const res = await fetch(apiUrl("/api/doctor/appointment-slots/save-day"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to save slot edits");

      setMessageType("success");
      setMessage(`Slot availability saved (${body.savedCount || 0} updated).`);
      await loadDaySlots(selectedDate);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to save slot edits");
    } finally {
      setSavingDay(false);
    }
  }

  function formatSlotTime(slot) {
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div className="p-6 space-y-4">
      <Card title="Edit Appointment Slots" right={<div className="text-xs text-slate-400">Tomorrow + 7 days</div>}>
        <div className="grid grid-cols-1 md:grid-cols-[240px_auto] gap-3 items-center">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl px-3 py-2 bg-[#111b38] ring-1 ring-slate-700/40 text-slate-100"
          >
            {editableDates.map((dateValue) => (
              <option key={dateValue} value={dateValue}>
                {dateValue}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-600" />Available</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" />Unavailable</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Pending request</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />Confirmed</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {daySlots.map((slot) => {
            const state = slotState(slot);
            return (
              <button
                key={slot.SlotID}
                type="button"
                onClick={() => onSlotClick(slot)}
                className={`rounded-xl px-2 py-2 text-[11px] font-semibold ${slotLabelClass(state)} ${state === "confirmed" ? "cursor-not-allowed opacity-90" : ""}`}
                title={state === "pending" ? "Click to review request" : undefined}
              >
                <div>{formatSlotTime(slot)}</div>
                <div className="mt-1 uppercase tracking-wide">{state}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={saveDayAvailability}
            disabled={savingDay || loading}
            className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingDay ? "Saving..." : "Save Day Slot Edits"}
          </button>
          <button
            type="button"
            onClick={() => loadDaySlots(selectedDate)}
            disabled={loading}
            className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
          >
            Reload Day
          </button>
        </div>
      </Card>

      <Card title="Confirmed Appointments">
        <div className="space-y-3 text-sm">
          {confirmedAppointments.length ? (
            confirmedAppointments.map((appt) => (
              <div key={appt.AppointmentID} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="font-semibold text-slate-900">{appt.patient_name || "Patient"}</div>
                <div className="text-xs text-slate-600 break-all">{appt.patient_email}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {new Date(appt.start_time).toLocaleString()} - {new Date(appt.end_time).toLocaleTimeString()}
                </div>
                <div className="mt-1 text-xs text-slate-600">Reason: {appt.reason || "-"}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">No confirmed appointments yet.</div>
          )}
        </div>
      </Card>

      {pendingModal ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#111b38] text-slate-100 p-4 ring-1 ring-slate-600/60">
            <div className="text-sm font-semibold">Pending Appointment Request</div>
            <div className="mt-2 text-xs text-slate-300">Patient: {pendingModal.patient_name || "Patient"}</div>
            <div className="text-xs text-slate-300 break-all">{pendingModal.patient_email || "No email"}</div>
            <div className="mt-1 text-xs text-slate-300">Slot: {formatSlotTime(pendingModal)}</div>
            <div className="mt-2 text-xs text-slate-300">Reason: {pendingModal.reason || "-"}</div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busyAppointmentId === pendingModal.AppointmentID}
                onClick={() => respondAppointment(pendingModal.AppointmentID, "confirm")}
                className="rounded-xl px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busyAppointmentId === pendingModal.AppointmentID}
                onClick={() => respondAppointment(pendingModal.AppointmentID, "reject")}
                className="rounded-xl px-3 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setPendingModal(null)}
                className="rounded-xl px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className={`text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div>
      ) : null}
    </div>
  );
}
