import React from "react";
import Card from "../components/Card.jsx";

export default function Placeholder({ title, hint }) {
  return (
    <div className="p-6">
      <Card title={title}>
        <div className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-4 text-sm text-slate-700">
          <div className="font-semibold mb-2">This page is a placeholder.</div>
          <div>{hint || "Tell me what content you want here (based on Figma), and I’ll generate the full UI."}</div>
        </div>
      </Card>
    </div>
  );
}
