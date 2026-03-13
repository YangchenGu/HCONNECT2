import React, { useState } from "react";

const initial = {
  painLevel: "",
  sleepHours: "",
  energy: "",
  notes: "",
};

export default function PatientReportForm() {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    localStorage.setItem("patient_daily_report", JSON.stringify({ ...form, submittedAt: new Date().toISOString() }));
    setSaved(true);
  }

  return (
    <div className="p-6 text-violet-100">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Daily condition report</h2>
        <p className="text-sm text-violet-300/80">Share how you feel today so your care team can monitor progress.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          <label className="block md:col-span-2">
            <div className="text-xs text-violet-300 mb-1">Energy level</div>
            <select
              value={form.energy}
              onChange={(e) => updateField("energy", e.target.value)}
              className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              required
            >
              <option value="">Select level</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
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

        <button type="submit" className="rounded-xl bg-violet-500 hover:bg-violet-400 text-white px-5 py-2.5 text-sm font-semibold transition">
          Submit report
        </button>

        {saved ? <div className="text-sm text-emerald-300">Report saved successfully.</div> : null}
      </form>
    </div>
  );
}
