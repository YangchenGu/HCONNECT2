import React from "react";
import { useNavigate } from "react-router-dom";

export default function Topbar({ title, search, setSearch, notificationCount = 0 }) {
  const navigate = useNavigate();
  const hasNotifications = Number(notificationCount) > 0;

  return (
    <div className="sticky top-0 z-10 bg-[#17122d]/88 backdrop-blur border-b border-violet-300/20">
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="text-lg font-semibold text-slate-100">{title}</div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-2xl bg-[#0f0c22]/80 ring-1 ring-violet-300/20 px-3 py-2">
            <span className="text-slate-400">🔎</span>
            <input
              className="outline-none text-sm w-72 bg-transparent text-slate-100 placeholder:text-slate-400"
              placeholder="Search patient / report..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="relative h-10 w-10 rounded-xl bg-[#0f0c22]/80 shadow-sm ring-1 ring-violet-300/20 grid place-items-center"
            title="Notifications"
            onClick={() => navigate("/notifications")}
          >
            🔔
            {hasNotifications ? (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] leading-4 text-white text-center ring-2 ring-[#17122d]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>
          <div className="h-10 w-10 rounded-xl bg-violet-900/50 grid place-items-center" title="Profile">
            👤
          </div>
        </div>
      </div>
    </div>
  );
}