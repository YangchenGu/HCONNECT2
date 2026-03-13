import React from "react";

export default function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl bg-[#111b38] shadow-sm ring-1 ring-slate-700/40 p-4 text-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}