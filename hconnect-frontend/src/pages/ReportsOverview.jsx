import React, { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import {
  reportFilters,
  wellbeingFactors,
  conditionSummary,
  preExistingByFactor,
  improvementRates,
  insights,
} from "../data/reports.js";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function ProgressBar({ value, max }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="w-full">
      <div className="h-2 rounded-full bg-slate-100 ring-1 ring-black/5 overflow-hidden">
        <div className="h-full bg-slate-900" style={{ width: pct + "%" }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data, unit = "" }) {
  const max = Math.max(...data.map((d) => d.value ?? d.count ?? d.rate ?? 0), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const label = d.factor || d.label || d.key;
        const v = d.value ?? d.count ?? d.rate;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="w-28 text-xs text-slate-600 truncate">{label}</div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-slate-100 ring-1 ring-black/5 overflow-hidden">
                <div className="h-full bg-slate-900" style={{ width: pct + "%" }} />
              </div>
            </div>
            <div className="w-16 text-right text-xs font-semibold text-slate-900">
              {v}
              {unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsOverview() {
  const [timeRange, setTimeRange] = useState(reportFilters.timeRangeOptions[2]); // 30 days
  const [cohort, setCohort] = useState(reportFilters.cohortOptions[0]);

  const totals = useMemo(() => {
    const totalPatients = 70;
    const flagged = wellbeingFactors.reduce((acc, f) => acc + (f.value >= 10 ? 1 : 0), 0);
    const avgScore = 72;
    const active = 85; // demo metric
    return { totalPatients, flagged, avgScore, active };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Filters row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">Reports — Overview</div>
          <span className="text-xs text-slate-500">
            ({cohort} • {timeRange})
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
            <span className="text-xs text-slate-500">Cohort</span>
            <select
              className="text-sm outline-none bg-transparent"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
            >
              {reportFilters.cohortOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
            <span className="text-xs text-slate-500">Time range</span>
            <select
              className="text-sm outline-none bg-transparent"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {reportFilters.timeRangeOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <button className="rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800">
            Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Total Patients" value={String(totals.totalPatients)} sub="Monitored in cohort" />
        <KPI label="Flagged Factors" value={String(totals.flagged)} sub="Value ≥ 10" />
        <KPI label="Active Patients" value={String(totals.active)} sub="Demo metric" />
        <KPI label="Average Health Score" value={String(totals.avgScore)} sub="Demo metric" />
      </div>

      {/* Wellbeing factors grid */}
      <Card
        title="Wellbeing factors"
        right={<span className="text-xs text-slate-500">Severity scale 0–14 (demo)</span>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wellbeingFactors.map((f) => (
            <div key={f.key} className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-900">{f.key}</div>
                <div
                  className={cn(
                    "text-xs rounded-full px-2 py-1",
                    f.trend.startsWith("-") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  )}
                >
                  {f.trend}
                </div>
              </div>
              <ProgressBar value={f.value} max={f.max} />
              <div className="mt-2 text-xs text-slate-500">
                Placeholder UI: later you can route to factor pages (Sleep/Stress/Nutrition…).
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-column analytics cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Condition summary">
          <div className="text-xs text-slate-500 mb-3">Distribution of pre-existing conditions (demo data).</div>
          <MiniBarChart data={conditionSummary.map((x) => ({ label: x.label, value: x.count }))} />
        </Card>

        <Card title="Pre-existing conditions by factor">
          <div className="text-xs text-slate-500 mb-3">
            Count of patients with pre-existing conditions aligned to wellbeing factors (demo).
          </div>
          <MiniBarChart data={preExistingByFactor.map((x) => ({ factor: x.factor, value: x.count }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Improvement rates">
          <div className="text-xs text-slate-500 mb-3">
            Improvement rate per wellbeing factor (demo). Higher is better.
          </div>
          <MiniBarChart data={improvementRates.map((x) => ({ factor: x.factor, value: x.rate }))} unit="%" />
        </Card>

        <Card title="Quick insights">
          <div className="space-y-3">
            {insights.map((i) => (
              <div key={i.title} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div className="text-sm font-semibold text-slate-900">{i.title}</div>
                <div className="mt-1 text-sm text-slate-700">{i.body}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
