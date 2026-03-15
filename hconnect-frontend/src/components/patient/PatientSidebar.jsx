import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/ui.js";

const links = [
  { to: "/", label: "Dashboard", icon: "⬢" },
  { to: "/patient/history", label: "My Health History", icon: "◔" },
  { to: "/patient/report", label: "Daily Report", icon: "✎" },
  { to: "/patient/appointments", label: "Appointments", icon: "◷" },
  { to: "/patient/advice", label: "Medical Advice", icon: "🩺" },
  { to: "/patient/notifications", label: "Notifications", icon: "🔔" },
  { to: "/patient/account", label: "Account Settings", icon: "⚙" },
];

export default function PatientSidebar({ user, logout }) {
  return (
    <aside className="sticky top-0 self-start h-screen w-72 shrink-0 border-r border-blue-300/20 bg-[#0f1a36] text-blue-100">
      <div className="h-full flex flex-col">
        <div className="px-5 pt-6 pb-4 border-b border-blue-300/12">
          <div className="text-xs tracking-[0.2em] text-blue-300/80">HCONNECT</div>
          <div className="mt-1 text-lg font-semibold text-white">Patient Portal</div>
        </div>

        <nav className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-1">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  isActive
                    ? "bg-blue-400/28 text-white ring-1 ring-blue-200/45 shadow-[0_0_0_1px_rgba(147,197,253,0.2),0_8px_20px_rgba(30,64,175,0.35)]"
                    : "text-blue-200/90 hover:bg-blue-500/10 hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-200" /> : null}
                  <span
                    className={cn(
                      "inline-grid h-7 w-7 place-items-center rounded-lg transition",
                      isActive ? "bg-blue-300/35 text-white" : "bg-blue-400/12 text-blue-200"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className={cn(isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-300/12">
          <div className="rounded-2xl bg-blue-900/40 p-3">
            <div className="text-sm font-semibold text-white truncate">{user?.name || "Patient"}</div>
            <div className="text-xs text-blue-300/85 truncate mt-0.5">{user?.email || "No email"}</div>
            <button
              onClick={() => logout()}
              className="mt-3 w-full rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 py-2 text-sm transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
