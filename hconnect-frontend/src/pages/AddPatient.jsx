import React, { useState } from "react";
import Card from "../components/Card.jsx";

export default function AddPatient() {
  const [form, setForm] = useState({
    name: "",
    dob: "",
    phone: "",
    email: "",
    address: "",
    history: "",
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function onSubmit(e) {
    e.preventDefault();
    alert("Saved (demo only). Hook this up to your backend/API later.");
  }

  return (
    <div className="p-6">
      <Card title="Add New Patient">
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">
              <div className="text-xs text-slate-500 mb-1">Full Name</div>
              <input
                className="w-full rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-slate-500 mb-1">DOB</div>
              <input
                className="w-full rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="DD-MM-YYYY"
                value={form.dob}
                onChange={(e) => setField("dob", e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-slate-500 mb-1">Phone</div>
              <input
                className="w-full rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="Enter contact number"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-slate-500 mb-1">Email</div>
              <input
                className="w-full rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="Enter email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </label>

            <label className="text-sm md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Address</div>
              <input
                className="w-full rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="Enter address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>

            <label className="text-sm md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Health History</div>
              <textarea
                className="w-full min-h-28 rounded-xl bg-white ring-1 ring-black/5 px-3 py-2 outline-none"
                placeholder="Past conditions, notes..."
                value={form.history}
                onChange={(e) => setField("history", e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" className="text-sm rounded-xl px-4 py-2 bg-slate-900 text-white hover:bg-slate-800">
              Save
            </button>
            <a href="/patients" className="text-sm rounded-xl px-4 py-2 bg-white ring-1 ring-black/5 hover:bg-slate-50">
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </div>
  );
}
