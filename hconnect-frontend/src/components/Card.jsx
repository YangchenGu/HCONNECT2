import React from "react";

export default function Card({ title, right, children }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}