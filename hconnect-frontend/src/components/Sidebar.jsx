import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/ui.js";

const NAV = [
  { section: "Dashboard", items: [{ to: "/", label: "Overview", icon: "📊" }] },
  {
    section: "Patient Management",
    items: [
      { to: "/patients", label: "Patient List", icon: "🧑‍🤝‍🧑" },
      { to: "/patients/new", label: "Add New Patient", icon: "➕" },
    ],
  },
  {
    section: "Appointments",
    items: [{ to: "/appointments", label: "Appointment", icon: "📅" }],
  },
  {
    section: "Report & Analysis",
    items: [
      { to: "/reports/overview", label: "Overview", icon: "🧾" },
      { to: "/reports/detail", label: "Detailed report", icon: "📈" },
    ],
  },
  { section: "Notifications", items: [{ to: "/notifications", label: "Notifications", icon: "🔔" }] },
  {
    section: "Settings",
    items: [
      { to: "/settings/account", label: "Account Settings", icon: "⚙️" },
      { to: "/settings/notifications", label: "Notification Settings", icon: "🛎️" },
    ],
  },
  { section: "Help", items: [{ to: "/help", label: "Help", icon: "❓" }] },
];

export default function Sidebar({ collapsed, setCollapsed, user, logout }) {
  return (
    <aside
      className={cn(
        "sticky top-0 self-start h-screen bg-[#120f27] text-slate-100 border-r border-violet-400/20 flex flex-col shrink-0",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center">🧬</div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold text-slate-100">Hconnect</div>
              <div className="text-xs text-violet-200/80">Health Provider</div>
            </div>
          )}
        </div>

        <button
          className="h-10 w-10 rounded-xl hover:bg-white/10 grid place-items-center"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "➡️" : "⬅️"}
        </button>
      </div>

      <div className="px-2 pb-4 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
        {NAV.map((group) => (
          <div key={group.section} className="mt-3">
            {!collapsed && (
              <div className="px-3 pb-2 text-xs uppercase tracking-wider text-slate-400">{group.section}</div>
            )}
            <div className="space-y-1">
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2 transition",
                      isActive ? "bg-violet-500/22 text-white" : "hover:bg-violet-400/12 text-slate-200"
                    )
                  }
                  title={collapsed ? it.label : undefined}
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-300/12 grid place-items-center">{it.icon}</div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left text-sm">{it.label}</div>
                      {typeof it.badge === "number" ? (
                        <div className="text-xs rounded-full bg-rose-500/90 px-2 py-0.5">{it.badge}</div>
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto p-3">
        <div className="rounded-2xl bg-violet-300/10 p-3 border border-violet-200/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center">👨‍⚕️</div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{user?.name || "User"}</div>
                <div className="text-xs text-slate-300 truncate">{user?.email}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => logout()}
              className="w-full mt-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm py-2 rounded-lg transition"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
