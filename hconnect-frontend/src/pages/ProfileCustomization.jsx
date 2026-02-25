import React, { useState } from "react";
import Card from "../components/Card.jsx";
import { profileUiDefaults, profileUiOptions } from "../data/profile_settings.js";

function OptionPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-2 text-sm ring-1 transition",
        active ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-black/5 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition",
          checked ? "bg-slate-900" : "bg-slate-300",
        ].join(" ")}
        aria-pressed={checked}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export default function ProfileCustomization() {
  const [ui, setUi] = useState(profileUiDefaults);
  const [msg, setMsg] = useState("");

  function save() {
    setMsg("Saved (demo). Next step: persist UI preferences (localStorage / user profile).");
    setTimeout(() => setMsg(""), 2200);
  }
  function reset() {
    setUi(profileUiDefaults);
    setMsg("Reset to defaults.");
    setTimeout(() => setMsg(""), 1600);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Profile customization</div>
          <div className="text-xs text-slate-500 mt-1">UI preferences page (placeholder settings).</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-2xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Theme">
            <div className="text-xs text-slate-500 mb-3">Placeholder theme selection.</div>
            <div className="flex flex-wrap gap-2">
              {profileUiOptions.themes.map((t) => (
                <OptionPill key={t} active={ui.theme === t} onClick={() => setUi({ ...ui, theme: t })}>
                  {t}
                </OptionPill>
              ))}
            </div>
          </Card>

          <Card title="Accent color">
            <div className="text-xs text-slate-500 mb-3">This only changes a label for now (wire later).</div>
            <div className="flex flex-wrap gap-2">
              {profileUiOptions.accents.map((a) => (
                <OptionPill key={a} active={ui.accent === a} onClick={() => setUi({ ...ui, accent: a })}>
                  {a}
                </OptionPill>
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-black/5 p-3">
              <div className="text-xs text-slate-500">Preview (placeholder)</div>
              <div className="mt-1 text-sm text-slate-900">Accent: {ui.accent}</div>
            </div>
          </Card>

          <Card title="Layout density">
            <div className="text-xs text-slate-500 mb-3">Controls spacing / font sizes (placeholder).</div>
            <div className="flex flex-wrap gap-2">
              {profileUiOptions.densities.map((d) => (
                <OptionPill key={d} active={ui.density === d} onClick={() => setUi({ ...ui, density: d })}>
                  {d}
                </OptionPill>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Language">
            <div className="text-xs text-slate-500 mb-2">Placeholder language selector.</div>
            <select
              className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
              value={ui.language}
              onChange={(e) => setUi({ ...ui, language: e.target.value })}
            >
              {profileUiOptions.languages.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Card>

          <Card title="Sidebar behavior">
            <Toggle
              checked={ui.sidebarAutoCollapse}
              onChange={(v) => setUi({ ...ui, sidebarAutoCollapse: v })}
              label="Auto-collapse sidebar"
              hint="Placeholder behavior: later auto-collapse on small screens."
            />
            <div className="mt-3 text-xs text-slate-500">
              Current setting: {ui.sidebarAutoCollapse ? "Enabled" : "Disabled"}
            </div>
          </Card>

          <Card title="Profile info">
            <div className="text-sm text-slate-700">
              Placeholder: connect this page to your account profile and display avatar, clinic, role, etc.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
