import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

function toDateKey(dateInput) {
  const value = new Date(dateInput);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildNextSevenDays(todayKey) {
  const [year, month, day] = String(todayKey || "").split("-").map((v) => Number(v));
  const base = Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(year, month - 1, day)
    : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  const days = [];

  for (let i = 0; i < 8; i += 1) {
    const value = new Date(start);
    value.setDate(start.getDate() + i);
    const key = toDateKey(value);
    days.push({
      key,
      value,
      label: value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      }),
    });
  }

  return days;
}

export default function PatientAppointments() {
  const { getAccessTokenSilently } = useAuth0();
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  const nextSevenDays = useMemo(() => buildNextSevenDays(todayKey), [todayKey]);
  const myBookedSlotIds = useMemo(() => {
    const activeStatuses = new Set(["pending", "confirmed"]);
    return new Set(
      myAppointments
        .filter((appt) => activeStatuses.has(String(appt.status || "").toLowerCase()))
        .map((appt) => String(appt.SlotID))
    );
  }, [myAppointments]);
  const slotsByDate = useMemo(() => {
    const grouped = {};
    for (const day of nextSevenDays) {
      grouped[day.key] = [];
    }
    for (const slot of slots) {
      const key = toDateKey(slot.start_time);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(slot);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return grouped;
  }, [nextSevenDays, slots]);

  const selectedDateSlots = slotsByDate[selectedDateKey] || [];

  async function loadLinkedDoctors() {
    setLoadingDoctors(true);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/linked-doctors"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load linked doctors");
      setDoctors(payload.doctors || []);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load linked doctors");
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadMyAppointments() {
    setLoadingAppointments(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/appointments"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load appointments");
      setMyAppointments(payload.appointments || []);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load appointments");
    } finally {
      setLoadingAppointments(false);
    }
  }

  useEffect(() => {
    loadLinkedDoctors();
    loadMyAppointments();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = toDateKey(new Date());
      setTodayKey((prev) => (prev === next ? prev : next));
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadDoctorSlots(doctor, options = {}) {
    const { clearMessage = false } = options;
    if (clearMessage) setMessage("");
    setLoadingSlots(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/patient/doctors/${doctor.DoctorID}/slots`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load slots");
      setSlots(payload.slots || []);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function openBooking(doctor) {
    setSelectedDoctor(doctor);
    setReason("");
    setSlotId("");
    setSlots([]);
    setSelectedDateKey(nextSevenDays[0]?.key || "");
    await loadDoctorSlots(doctor, { clearMessage: true });
  }

  function backToDoctors() {
    setSelectedDoctor(null);
    setSelectedDateKey("");
    setSlotId("");
    setReason("");
  }

  useEffect(() => {
    if (!selectedDoctor) return;
    if (!selectedDateKey) {
      setSelectedDateKey(nextSevenDays[0]?.key || "");
      setSlotId("");
      return;
    }
    const hasSelectedSlot = selectedDateSlots.some((slot) => String(slot.SlotID) === String(slotId));
    if (slotId && !hasSelectedSlot) {
      setSlotId("");
    }
  }, [nextSevenDays, selectedDateKey, selectedDateSlots, selectedDoctor, slotId]);

  async function submitBooking(e) {
    e.preventDefault();
    if (!selectedDoctor) return;

    setSubmitting(true);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/appointments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctor.DoctorID,
          slotId: Number(slotId),
          reason,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const backendMessage = String(payload.error || "");
        const staleSlot =
          res.status === 409 &&
          (backendMessage.toLowerCase().includes("slot is not available") ||
            backendMessage.toLowerCase().includes("slot already booked"));

        if (staleSlot) {
          setMessageType("error");
          setMessage("Slot availability was updated. Please choose another slot.");
          setSlotId("");
          await loadDoctorSlots(selectedDoctor);
          return;
        }

        throw new Error(payload.error || "Failed to submit appointment request");
      }
      setMessageType("success");
      setMessage("Appointment request submitted successfully.");
      setSlotId("");
      setReason("");
      await Promise.all([loadDoctorSlots(selectedDoctor), loadMyAppointments()]);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to submit appointment request");
    } finally {
      setSubmitting(false);
    }
  }

  function formatSlot(slot) {
    const start = new Date(slot.start_time);
    const end = new Date(slot.end_time);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function isSlotSelectable(slot) {
    return !slot.is_booked && slot.is_available;
  }

  function slotTag(slot) {
    if (slot.is_booked && myBookedSlotIds.has(String(slot.SlotID))) return "Booked by you";
    if (slot.is_booked) return "Booked";
    if (!slot.is_available) return "Unavailable";
    return "Available";
  }

  function doctorBookingTitle(doctor) {
    if (!doctor) return "Doctor";
    const displayName = String(doctor.doctor_display_name || "").trim();
    const name = String(doctor.doctor_name || "").trim();
    const email = String(doctor.doctor_email || "").trim();
    if (displayName && email && displayName.toLowerCase() !== email.toLowerCase()) {
      return `${displayName} (${email})`;
    }
    if (name && email && name.toLowerCase() !== email.toLowerCase()) {
      return `${name} (${email})`;
    }
    return name || email || "Doctor";
  }

  function doctorDisplayName(entity) {
    if (!entity) return "Doctor";
    const displayName = String(entity.doctor_display_name || "").trim();
    if (displayName) return displayName;
    const name = String(entity.doctor_name || "").trim();
    if (name) return name;
    return "Doctor";
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    if (value === "confirmed") return "bg-emerald-600 text-white";
    if (value === "pending") return "bg-amber-500 text-slate-900";
    if (value === "cancelled") return "bg-rose-600 text-white";
    return "bg-slate-600 text-white";
  }

  return (
    <div className="p-6 text-violet-100 space-y-4">
      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">My Appointments</h2>
          <button
            type="button"
            onClick={loadMyAppointments}
            disabled={loadingAppointments}
            className="rounded-lg border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loadingAppointments ? <div className="text-sm text-violet-200">Loading appointments...</div> : null}

        {!loadingAppointments && myAppointments.length ? (
          <div className="space-y-2">
            {myAppointments.map((appt) => (
              <div key={appt.AppointmentID} className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-white">{doctorDisplayName(appt)}</div>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${statusClass(appt.status)}`}>{appt.status}</span>
                </div>
                <div className="text-xs text-violet-300/90 break-all mt-1">{appt.doctor_email}</div>
                <div className="text-xs text-violet-300/90 mt-1">
                  {new Date(appt.start_time).toLocaleString()} - {new Date(appt.end_time).toLocaleTimeString()}
                </div>
                <div className="mt-1 text-xs text-violet-200/85">Reason: {appt.reason || "-"}</div>
              </div>
            ))}
          </div>
        ) : null}

        {!loadingAppointments && !myAppointments.length ? (
          <div className="text-sm text-violet-300/80">No appointments yet.</div>
        ) : null}
      </div>

      {!selectedDoctor ? (
        <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">Book with Linked Doctors</h2>
          <p className="text-sm text-violet-300/80">Choose one doctor below to request an appointment.</p>

          {loadingDoctors ? <div className="text-sm text-violet-200">Loading doctors...</div> : null}

          {!loadingDoctors && !doctors.length ? (
            <div className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3 text-sm text-violet-200">
              No linked doctors yet. Accept a doctor match request first.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {doctors.map((doctor) => (
              <div key={doctor.DoctorID} className="rounded-xl border border-violet-300/15 bg-[#1a1335] p-3">
                <div className="text-sm font-semibold text-white">{doctorDisplayName(doctor)}</div>
                <div className="text-xs text-violet-300/90 break-all">{doctor.doctor_email}</div>
                <div className="mt-1 text-xs text-violet-300/80">
                  {doctor.specialty || "General"} {doctor.institution ? ` ${doctor.institution}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => openBooking(doctor)}
                  className="mt-3 rounded-lg bg-violet-500 hover:bg-violet-400 text-white px-3 py-1.5 text-xs font-semibold"
                >
                  Book This Doctor
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submitBooking} className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">Book with {doctorBookingTitle(selectedDoctor)}</h2>
            <button
              type="button"
              onClick={backToDoctors}
              className="rounded-lg border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 px-3 py-1.5 text-xs"
            >
              Back
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-violet-300">Select date (tomorrow + 7 days)</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {nextSevenDays.map((day) => {
                const active = selectedDateKey === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(day.key);
                      setSlotId("");
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs transition ${
                      active
                        ? "border-violet-300/60 bg-violet-500 text-white"
                        : "border-violet-300/20 bg-[#1a1335] text-violet-200 hover:border-violet-300/40"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-violet-300">Select one slot</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {selectedDateSlots.map((slot) => {
                const active = String(slot.SlotID) === String(slotId);
                const selectable = isSlotSelectable(slot);
                return (
                  <button
                    key={slot.SlotID}
                    type="button"
                    onClick={() => {
                      if (!selectable) return;
                      setSlotId(String(slot.SlotID));
                    }}
                    disabled={loadingSlots || !selectable}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "border-emerald-300/80 bg-emerald-500 text-white"
                        : selectable
                          ? "border-violet-300/20 bg-[#1a1335] text-violet-100 hover:border-violet-300/40"
                          : "border-rose-300/25 bg-rose-900/25 text-rose-200 cursor-not-allowed opacity-70"
                    } ${loadingSlots ? "opacity-60" : ""}`}
                  >
                    <div>{formatSlot(slot)}</div>
                    {!selectable ? <div className="mt-1 text-[10px] uppercase tracking-wide">{slotTag(slot)}</div> : null}
                  </button>
                );
              })}
            </div>
            {!loadingSlots && !selectedDateSlots.length ? (
              <div className="text-sm text-amber-300">No slots found for this date. Please choose another date.</div>
            ) : null}
          </div>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Reason for visit</div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe your concern"
              required
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !slotId}
            className="rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold transition"
          >
            {submitting ? "Submitting..." : "Submit Appointment Request"}
          </button>

          {!loadingSlots && !slots.length ? (
            <div className="text-sm text-amber-300">No available slots currently for this doctor.</div>
          ) : null}
        </form>
      )}

      {message ? <div className={`mt-3 text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div> : null}
    </div>
  );
}
