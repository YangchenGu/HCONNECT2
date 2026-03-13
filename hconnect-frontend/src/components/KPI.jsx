import React from "react";

export default function KPI({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-[#111b38] shadow-sm ring-1 ring-slate-700/40 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}