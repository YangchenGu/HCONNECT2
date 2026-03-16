import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

const initial = {
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  weightKg: "",
  sleepHours: "",
  sleepQuality: "",
  painLevel: "",
  notes: "",
};

export default function PatientReportForm() {
  const { getAccessTokenSilently } = useAuth0();
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [loadingToday, setLoadingToday] = useState(false);
  const [hasTodayReport, setHasTodayReport] = useState(false);

  useEffect(() => {
    async function loadTodayReport() {
      setLoadingToday(true);
      setMessage("");
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/patient/reports/today"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load today's report");

        const nextForm = {
          ...initial,
          ...(payload.metrics || {}),
          notes: payload.note || "",
        };
        setForm(nextForm);
        setHasTodayReport(Boolean(payload.hasReport));
      } catch (error) {
        setMessageType("error");
        setMessage(error.message || "Failed to load today's report");
      } finally {
        setLoadingToday(false);
      }
    }

    loadTodayReport();
  }, [getAccessTokenSilently]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/reports"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bloodPressureSystolic: form.bloodPressureSystolic,
          bloodPressureDiastolic: form.bloodPressureDiastolic,
          weightKg: form.weightKg,
          sleepHours: form.sleepHours,
          sleepQuality: form.sleepQuality,
          painLevel: form.painLevel,
          note: form.notes,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to submit report");

      setSaved(true);
      setHasTodayReport(true);
      setMessageType("success");
      setMessage(payload.mode === "updated" ? "Today's report updated successfully." : "Today's report submitted successfully.");
    } catch (error) {
      setSaved(false);
      setMessageType("error");
      setMessage(error.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 text-violet-100">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Daily condition report</h2>
        <p className="text-sm text-violet-300/80">Share how you feel today so your care team can monitor progress.</p>
        {!loadingToday && !hasTodayReport ? (
          <div className="text-sm text-amber-300">You have not submitted a report today.</div>
        ) : null}
        {!loadingToday && hasTodayReport ? (
          <div className="text-sm text-sky-300">Today's report is loaded. You can update it below.</div>
        ) : null}
        {loadingToday ? <div className="text-sm text-violet-300/80">Loading today's report...</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Blood pressure systolic (mmHg)</div>
            <input
              type="number"
              min="70"
              max="250"
              value={form.bloodPressureSystolic}
              onChange={(e) => updateField("bloodPressureSystolic", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Blood pressure diastolic (mmHg)</div>
            <input
              type="number"
              min="40"
              max="150"
              value={form.bloodPressureDiastolic}
              onChange={(e) => updateField("bloodPressureDiastolic", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Weight (kg)</div>
            <input
              type="number"
              min="20"
              max="400"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => updateField("weightKg", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Sleep hours</div>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={form.sleepHours}
              onChange={(e) => updateField("sleepHours", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Sleep quality (0-10)</div>
            <input
              type="number"
              min="0"
              max="10"
              value={form.sleepQuality}
              onChange={(e) => updateField("sleepQuality", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Pain level (0-10)</div>
            <input
              type="number"
              min="0"
              max="10"
              value={form.painLevel}
              onChange={(e) => updateField("painLevel", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <div className="text-xs text-violet-300 mb-1">Additional notes</div>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              placeholder="Symptoms, medication side effects, or anything else..."
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold transition"
        >
          {submitting ? "Submitting..." : hasTodayReport ? "Update today's report" : "Submit today's report"}
        </button>

        {saved ? <div className="text-sm text-emerald-300">Report saved successfully.</div> : null}
        {message ? <div className={`text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div> : null}
      </form>
    </div>
  );
}
