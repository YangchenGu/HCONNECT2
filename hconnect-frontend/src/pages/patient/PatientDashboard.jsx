import React from "react";

const cards = [
  { label: "Medication Adherence", value: "92%", note: "Last 7 days" },
  { label: "Avg Sleep", value: "7.4h", note: "This week" },
  { label: "Mood Trend", value: "Stable", note: "No risk signals" },
];

const todayTasks = [
  "Take blood pressure reading before 9 PM",
  "Submit daily condition report",
  "Drink at least 2L of water",
];

export default function PatientDashboard() {
  return (
    <div className="p-6 space-y-6 text-violet-100">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <article key={c.label} className="rounded-2xl border border-violet-300/15 bg-violet-900/40 p-4">
            <div className="text-xs text-violet-300/80">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-white">{c.value}</div>
            <div className="mt-2 text-xs text-violet-300/70">{c.note}</div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">Today at a glance</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#211742] p-4 border border-violet-300/10">
            <div className="text-sm text-violet-200">Latest blood pressure</div>
            <div className="mt-2 text-xl text-white font-semibold">118 / 76 mmHg</div>
            <div className="mt-1 text-xs text-violet-300/70">Recorded 2 hours ago</div>
          </div>
          <div className="rounded-xl bg-[#211742] p-4 border border-violet-300/10">
            <div className="text-sm text-violet-200">Next appointment</div>
            <div className="mt-2 text-xl text-white font-semibold">Mar 12, 10:30 AM</div>
            <div className="mt-1 text-xs text-violet-300/70">Dr. Carter • Virtual visit</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">My daily checklist</h2>
        <ul className="mt-3 space-y-2">
          {todayTasks.map((item) => (
            <li key={item} className="rounded-lg border border-violet-300/10 bg-[#1c153a] px-3 py-2 text-sm text-violet-100/95">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
