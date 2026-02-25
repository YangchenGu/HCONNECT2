import React, { useMemo } from "react";
import Card from "../components/Card.jsx";
import KPI from "../components/KPI.jsx";
import { patients as base } from "../data/mock.js";

export default function Patients({ search }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => [p.id, p.name, p.risk, p.status].some((x) => String(x).toLowerCase().includes(q)));
  }, [search]);

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <KPI label="Total" value={String(base.length)} />
        <KPI label="High Risk" value={String(base.filter((p) => p.risk === "High").length)} />
        <KPI label="Active" value={String(base.filter((p) => p.status === "Active").length)} />
        <KPI label="Avg Score" value="72" />
      </div>

      <Card
        title="Patient List"
        right={
          <a href="/patients/new" className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800">
            + Add
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last Update</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.id}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        p.risk === "High"
                          ? "text-xs rounded-full bg-rose-100 text-rose-800 px-2 py-1"
                          : p.risk === "Medium"
                          ? "text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-1"
                          : "text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-1"
                      }
                    >
                      {p.risk}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        p.status === "Active"
                          ? "text-xs rounded-full bg-sky-100 text-sky-800 px-2 py-1"
                          : "text-xs rounded-full bg-slate-200 text-slate-700 px-2 py-1"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{p.lastUpdate}</td>

                  <td className="py-3 pr-4 text-slate-900 font-semibold">{p.score}</td>
                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      <button className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">View</button>
                      <button className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No patients match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
