import React from "react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { kpis, patientOverview } from "../data/mock.js";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPI key={k.label} label={k.label} value={k.value} sub={k.sub} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Health Trend" right={<button className="text-xs text-slate-500 hover:text-slate-700">May ▾</button>}>
          <div className="h-40 rounded-xl bg-slate-100 grid place-items-center text-slate-500 text-sm">
            (Chart placeholder)
          </div>
        </Card>

        <Card title="Engagement">
          <div className="h-40 rounded-xl bg-slate-100 grid place-items-center text-slate-500 text-sm">
            (Bar chart placeholder)
          </div>
        </Card>

        <Card title="Intervention">
          <div className="h-40 rounded-xl bg-slate-100 grid place-items-center text-slate-500 text-sm">
            (Donut chart placeholder)
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Goal Overview">
          <div className="space-y-2">
            {["Goal 1", "Goal 2", "Goal 3", "Goal 4"].map((g, idx) => (
              <div key={g} className="flex items-center justify-between rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="text-sm text-slate-800">{g}</div>
                <div className={idx % 2 === 0 ? "text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-1" : "text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-1"}>
                  {idx % 2 === 0 ? "On track" : "Needs attention"}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Patient Overview">
          <div className="space-y-3">
            {patientOverview.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200 grid place-items-center">👤</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 truncate">{p.note}</div>
                </div>
                <div
                  className={
                    p.tag === "High"
                      ? "text-xs rounded-full bg-rose-100 text-rose-800 px-2 py-1"
                      : p.tag === "Medium"
                      ? "text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-1"
                      : "text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-1"
                  }
                >
                  {p.tag}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
