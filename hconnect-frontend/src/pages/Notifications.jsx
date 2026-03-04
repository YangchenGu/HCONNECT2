import React from "react";
import Card from "../components/Card.jsx";
import { alerts } from "../data/mock.js";

export default function Notifications() {
  return (
    <div className="p-6 space-y-4">
      <Card title="High Priority Alerts">
        <div className="space-y-3">
          {alerts.high.map((a) => (
            <div key={a.id} className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-3">
              <div className="text-sm font-semibold text-rose-900">{a.text}</div>
              <div className="mt-1 text-xs text-rose-700">{a.time}</div>
              <div className="mt-3 flex gap-2">
                <button className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">
                  View Details
                </button>
                <button className="text-xs rounded-xl px-3 py-2 bg-slate-900 text-white hover:bg-slate-800">
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Low Priority Alerts">
        <div className="space-y-3">
          {alerts.low.map((a) => (
            <div key={a.id} className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
              <div className="text-sm font-semibold text-slate-900">{a.text}</div>
              <div className="mt-1 text-xs text-slate-500">{a.time}</div>
              <div className="mt-3 flex gap-2">
                <button className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">
                  View Reports
                </button>
                <button className="text-xs rounded-xl px-3 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">
                  Read More
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
