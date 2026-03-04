import React from "react";

export default function KPI({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}