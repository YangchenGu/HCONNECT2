import React from "react";
import { useNavigate } from "react-router-dom";

export default function PatientTopbar({ title, notificationCount = 0 }) {
  const navigate = useNavigate();
  const hasNotifications = Number(notificationCount) > 0;

  return (
    <header className="sticky top-0 z-10 border-b border-blue-300/15 bg-[#132244]/88 backdrop-blur">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-xs text-blue-300/80 mt-0.5">Personal care insights and actions</p>
        </div>
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/patient/notifications")}
            className="relative h-10 w-10 rounded-xl border border-blue-300/25 bg-blue-900/45 text-blue-100"
            title="Notifications"
          >
            🔔
            {hasNotifications ? (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] leading-4 text-white text-center ring-2 ring-[#132244]">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-900/45 px-3 py-1 text-xs text-blue-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Secure session
          </div>
        </div>
      </div>
    </header>
  );
}
