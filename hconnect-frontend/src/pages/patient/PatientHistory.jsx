import React from "react";

const rows = [
  { date: "2026-03-06", bp: "120/78", glucose: "5.4 mmol/L", symptoms: "Mild headache" },
  { date: "2026-03-05", bp: "116/74", glucose: "5.1 mmol/L", symptoms: "No issues" },
  { date: "2026-03-04", bp: "124/80", glucose: "5.7 mmol/L", symptoms: "Fatigue" },
  { date: "2026-03-03", bp: "118/76", glucose: "5.3 mmol/L", symptoms: "No issues" },
];

export default function PatientHistory() {
  return (
    <div className="p-6 text-violet-100">
      <div className="rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5">
        <h2 className="text-base font-semibold text-white">Historical condition data</h2>
        <p className="mt-1 text-sm text-violet-300/80">Track your key health indicators over time.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-violet-300/80 border-b border-violet-300/20">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Blood Pressure</th>
                <th className="py-2 pr-3 font-medium">Glucose</th>
                <th className="py-2 pr-3 font-medium">Symptoms</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-violet-300/10 last:border-b-0">
                  <td className="py-3 pr-3 text-violet-100">{r.date}</td>
                  <td className="py-3 pr-3">{r.bp}</td>
                  <td className="py-3 pr-3">{r.glucose}</td>
                  <td className="py-3 pr-3">{r.symptoms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
