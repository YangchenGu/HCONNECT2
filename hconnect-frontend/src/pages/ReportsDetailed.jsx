import React, { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { detailFilters, reportRows, detailKpis } from "../data/reports_detail.js";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

function Chip({ children, tone = "slate" }) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-100 text-rose-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "sky"
      ? "bg-sky-100 text-sky-800"
      : "bg-slate-200 text-slate-800";
  return <span className={cn("text-xs rounded-full px-2 py-1", toneClass)}>{children}</span>;
}

function RiskChip({ risk }) {
  if (risk === "High") return <Chip tone="rose">High</Chip>;
  if (risk === "Medium") return <Chip tone="amber">Medium</Chip>;
  return <Chip tone="emerald">Low</Chip>;
}

function StatusChip({ status }) {
  return status === "Active" ? <Chip tone="sky">Active</Chip> : <Chip>Inactive</Chip>;
}

export default function ReportsDetailed() {
  const [q, setQ] = useState("");
  const [timeRange, setTimeRange] = useState(detailFilters.timeRangeOptions[2]); // 30 days
  const [cohort, setCohort] = useState(detailFilters.cohortOptions[0]);
  const [status, setStatus] = useState("Any");
  const [risk, setRisk] = useState("Any");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return reportRows.filter((r) => {
      const matchesQuery =
        !query ||
        [r.id, r.patientId, r.patientName, r.condition, r.lastUpdate, (r.flags || []).join(" ")].some((x) =>
          String(x).toLowerCase().includes(query)
        );

      const matchesStatus = status === "Any" ? true : r.status === status;
      const matchesRisk = risk === "Any" ? true : r.risk === risk;

      const matchesCohort =
        cohort === "All patients"
          ? true
          : cohort === "High risk"
          ? r.risk === "High"
          : cohort === "Diabetes"
          ? String(r.condition).toLowerCase().includes("diabetes")
          : cohort === "Hypertension"
          ? String(r.condition).toLowerCase().includes("hypertension")
          : true;

      // timeRange is a placeholder in UI for now (kept for future API params)
      return matchesQuery && matchesStatus && matchesRisk && matchesCohort;
    });
  }, [q, timeRange, cohort, status, risk]);

  function onExport() {
    alert("Export (demo). Next step: generate CSV/PDF and download.");
  }

  function onRowAction(action, row) {
    alert(`${action}: ${row.patientName} (demo only)`);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Reports — Detailed report</div>
          <div className="text-xs text-slate-500 mt-1">
            Fully-designed UI skeleton: filters + table + actions (wire to API later).
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={onExport}
            className="rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
          >
            Export
          </button>
          <button className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50">
            Share
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {detailKpis.map((k) => (
          <KPI key={k.label} label={k.label} value={k.value} sub={k.sub} />
        ))}
      </div>

      <Card title="Filters">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="md:col-span-2">
            <div className="text-xs text-slate-500 mb-1">Search</div>
            <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2">
              <span className="text-slate-400">🔎</span>
              <input
                className="w-full outline-none text-sm bg-transparent"
                placeholder="Patient / report / flag..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </label>

          <label>
            <div className="text-xs text-slate-500 mb-1">Cohort</div>
            <select
              className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
            >
              {detailFilters.cohortOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-xs text-slate-500 mb-1">Time range</div>
            <select
              className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {detailFilters.timeRangeOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-xs text-slate-500 mb-1">Status / Risk</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {detailFilters.statusOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
              >
                {detailFilters.riskOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </Card>

      <Card title="Report table" right={<span className="text-xs text-slate-500">{filtered.length} rows</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Condition</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last update</th>
                <th className="py-2 pr-4">Avg score</th>
                <th className="py-2 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 align-top">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-slate-900">{r.patientName}</div>
                    <div className="text-xs text-slate-500">
                      {r.patientId} • {r.id}
                    </div>

                    {(r.flags?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.flags.slice(0, 2).map((f) => (
                          <Chip key={f} tone="amber">
                            {f}
                          </Chip>
                        ))}
                        {r.flags.length > 2 ? <Chip>+{r.flags.length - 2}</Chip> : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400">No flags</div>
                    )}
                  </td>

                  <td className="py-3 pr-4 text-slate-700">{r.condition}</td>
                  <td className="py-3 pr-4">
                    <RiskChip risk={r.risk} />
                  </td>
                  <td className="py-3 pr-4">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{r.lastUpdate}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{r.avgScore}</td>

                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onRowAction("View", r)}
                        className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onRowAction("Notes", r)}
                        className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50"
                      >
                        Notes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No rows match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Notes (placeholder panel)">
        <div className="text-sm text-slate-700">
          This is a UI placeholder area for: selected-row details, trends, and clinician notes editor.
        </div>
      </Card>
    </div>
  );
}
