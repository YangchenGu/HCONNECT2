import React, { useState } from "react";
import Card from "../components/Card.jsx";
import { faqs, supportContacts } from "../data/help.js";

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-start justify-between gap-4">
        <div className="text-sm font-semibold text-slate-900 text-left">{q}</div>
        <div className="text-slate-500">{open ? "−" : "+"}</div>
      </button>
      {open ? <div className="mt-2 text-sm text-slate-700">{a}</div> : null}
    </div>
  );
}

export default function Help() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [msg, setMsg] = useState("");

  function submit(e) {
    e.preventDefault();
    setMsg("Sent (demo). Next step: create ticket via API / email service.");
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setMsg(""), 2200);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900">Help</div>
        <div className="text-xs text-slate-500 mt-1">FAQ + contact support (UI skeleton).</div>
      </div>

      {msg ? (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="FAQ">
            <div className="space-y-3">
              {faqs.map((x) => (
                <FAQItem key={x.q} q={x.q} a={x.a} />
              ))}
            </div>
          </Card>

          <Card title="Contact support">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs text-slate-500 mb-1">Name</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </label>
              <label>
                <div className="text-xs text-slate-500 mb-1">Email</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </label>
              <label className="md:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Message</div>
                <textarea
                  className="w-full min-h-[120px] rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Describe the issue or question (demo)."
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button className="rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800">
                  Send
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Support info">
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-semibold text-slate-900">{supportContacts.email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="font-semibold text-slate-900">{supportContacts.phone}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Hours</div>
                <div className="font-semibold text-slate-900">{supportContacts.hours}</div>
              </div>
            </div>
          </Card>

          <Card title="Shortcuts">
            <div className="space-y-2 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                Placeholder: link to docs / onboarding / training materials.
              </div>
              <div className="rounded-xl bg-slate-50 ring-1 ring-black/5 p-3">
                Placeholder: link to privacy policy / terms.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
