import React from "react";

export default function Topbar({ title, search, setSearch }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200">
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="text-lg font-semibold text-slate-900">{title}</div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
            <span className="text-slate-400">🔎</span>
            <input
              className="outline-none text-sm w-72 bg-transparent"
              placeholder="Search patient / report..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="h-10 w-10 rounded-xl bg-white shadow-sm ring-1 ring-black/5 grid place-items-center" title="Notifications">
            🔔
          </button>
          <div className="h-10 w-10 rounded-xl bg-slate-200 grid place-items-center" title="Profile">
            👤
          </div>
        </div>
      </div>
    </div>
  );
}