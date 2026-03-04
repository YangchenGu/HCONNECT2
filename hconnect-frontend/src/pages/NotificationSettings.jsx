import React, { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { notificationDefaults, notificationOptions } from "../data/notification_settings.js";

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

export default function NotificationSettings() {
  const [state, setState] = useState(notificationDefaults);
  const [msg, setMsg] = useState("");

  const digestValue = useMemo(() => {
    if (!state.digest.enabled) return "Off";
    return state.digest.frequency || "Daily";
  }, [state.digest.enabled, state.digest.frequency]);

  function save() {
    setMsg("Saved (demo). Next step: persist to backend / user profile.");
    setTimeout(() => setMsg(""), 2200);
  }

  function reset() {
    setState(notificationDefaults);
    setMsg("Reset to defaults.");
    setTimeout(() => setMsg(""), 1800);
  }

  function setDigest(v) {
    if (v === "Off") {
      setState({ ...state, digest: { ...state.digest, enabled: false } });
    } else {
      setState({ ...state, digest: { enabled: true, frequency: v } });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Notification Settings</div>
          <div className="text-xs text-slate-500 mt-1">UI skeleton: toggles + rules + digest (wire later).</div>
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
          <Card title="Channels">
            <div className="space-y-3">
              <Toggle
                checked={state.channels.email}
                onChange={(v) => setState({ ...state, channels: { ...state.channels, email: v } })}
                label="Email"
                hint="Send alerts and weekly summary to your email."
              />
              <Toggle
                checked={state.channels.sms}
                onChange={(v) => setState({ ...state, channels: { ...state.channels, sms: v } })}
                label="SMS"
                hint="Use for critical alerts only (placeholder)."
              />
              <Toggle
                checked={state.channels.inApp}
                onChange={(v) => setState({ ...state, channels: { ...state.channels, inApp: v } })}
                label="In-app notifications"
                hint="Show alerts inside the dashboard."
              />
            </div>
          </Card>

          <Card title="Priority rules">
            <div className="space-y-3">
              <Toggle
                checked={state.priorities.high}
                onChange={(v) => setState({ ...state, priorities: { ...state.priorities, high: v } })}
                label="High priority alerts"
                hint="Severe risk flags, urgent reminders."
              />
              <Toggle
                checked={state.priorities.low}
                onChange={(v) => setState({ ...state, priorities: { ...state.priorities, low: v } })}
                label="Low priority alerts"
                hint="General updates, non-urgent changes."
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Digest">
            <div className="text-xs text-slate-500 mb-2">Receive a periodic summary.</div>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Frequency</div>
              <select
                className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                value={digestValue}
                onChange={(e) => setDigest(e.target.value)}
              >
                {notificationOptions.digestFrequencies.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-black/5 p-3">
              <div className="text-xs text-slate-500">Preview</div>
              <div className="mt-1 text-sm text-slate-800">
                {digestValue === "Off"
                  ? "No digest will be sent."
                  : `A ${digestValue.toLowerCase()} digest will be sent via enabled channels.`}
              </div>
            </div>
          </Card>

          <Card title="Quiet hours">
            <Toggle
              checked={state.quietHours.enabled}
              onChange={(v) => setState({ ...state, quietHours: { ...state.quietHours, enabled: v } })}
              label="Enable quiet hours"
              hint="Pause non-urgent alerts within a time window."
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label>
                <div className="text-xs text-slate-500 mb-1">Start</div>
                <input
                  type="time"
                  disabled={!state.quietHours.enabled}
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none disabled:opacity-60"
                  value={state.quietHours.start}
                  onChange={(e) => setState({ ...state, quietHours: { ...state.quietHours, start: e.target.value } })}
                />
              </label>
              <label>
                <div className="text-xs text-slate-500 mb-1">End</div>
                <input
                  type="time"
                  disabled={!state.quietHours.enabled}
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none disabled:opacity-60"
                  value={state.quietHours.end}
                  onChange={(e) => setState({ ...state, quietHours: { ...state.quietHours, end: e.target.value } })}
                />
              </label>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Placeholder logic: later you can allow high-priority alerts to bypass quiet hours.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
