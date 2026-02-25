import React, { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { accountProfileDefaults, securityDefaults } from "../data/account_settings.js";

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
    </div>
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

export default function AccountSettings() {
  const [profile, setProfile] = useState(accountProfileDefaults);
  const [security, setSecurity] = useState(securityDefaults);
  const [statusMsg, setStatusMsg] = useState("");

  const canSave = useMemo(() => {
    return profile.fullName.trim() && profile.email.trim();
  }, [profile]);

  function saveProfile(e) {
    e.preventDefault();
    setStatusMsg("Saved (demo). Next step: connect to backend / auth.");
    setTimeout(() => setStatusMsg(""), 2500);
  }

  function changePassword() {
    alert("Change password (demo). Next step: open modal + verify current password.");
  }

  function logoutEverywhere() {
    alert("Log out of all sessions (demo). Next step: call auth revoke endpoint.");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Account Settings</div>
          <div className="text-xs text-slate-500 mt-1">Profile + security UI skeleton (ready to wire up).</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProfile(accountProfileDefaults)}
            className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={saveProfile}
            disabled={!canSave}
            className={[
              "rounded-2xl px-4 py-2 text-sm",
              canSave ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            Save
          </button>
        </div>
      </div>

      {statusMsg ? (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-900">
          {statusMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Profile">
            <SectionTitle title="Basic information" subtitle="These fields are placeholders; store to DB later." />

            <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs text-slate-500 mb-1">Full name</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none focus:ring-black/10"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                />
              </label>

              <label>
                <div className="text-xs text-slate-500 mb-1">Role</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                />
              </label>

              <label className="md:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Email</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </label>

              <label>
                <div className="text-xs text-slate-500 mb-1">Phone</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </label>

              <label>
                <div className="text-xs text-slate-500 mb-1">Clinic</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.clinic}
                  onChange={(e) => setProfile({ ...profile, clinic: e.target.value })}
                />
              </label>

              <div className="md:col-span-2 flex items-center justify-between rounded-2xl bg-slate-50 ring-1 ring-black/5 p-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Profile photo</div>
                  <div className="text-xs text-slate-500 mt-1">Placeholder: upload avatar / clinic logo.</div>
                </div>
                <button
                  type="button"
                  onClick={() => alert("Upload photo (demo). Next step: file picker + storage.")}
                  className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Upload
                </button>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className={[
                    "w-full rounded-2xl px-4 py-2 text-sm",
                    canSave ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed",
                  ].join(" ")}
                  disabled={!canSave}
                >
                  Save profile
                </button>
              </div>
            </form>
          </Card>

          <Card title="Security">
            <SectionTitle
              title="Authentication"
              subtitle="UI skeleton: wire these actions to your auth provider later."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
                <div className="text-xs text-slate-500">Last login</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{security.lastLogin}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
                <div className="text-xs text-slate-500">Last password change</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{security.lastPasswordChange}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Toggle
                checked={security.twoFactorEnabled}
                onChange={(v) => setSecurity({ ...security, twoFactorEnabled: v })}
                label="Two-factor authentication (2FA)"
                hint="Placeholder: enable/disable 2FA."
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={changePassword}
                  className="flex-1 rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Change password
                </button>
                <button
                  type="button"
                  onClick={logoutEverywhere}
                  className="flex-1 rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Log out everywhere
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Preferences">
            <div className="space-y-3">
              <Toggle
                checked={true}
                onChange={() => {}}
                label="Email updates"
                hint="Placeholder toggle."
              />
              <Toggle
                checked={false}
                onChange={() => {}}
                label="SMS updates"
                hint="Placeholder toggle."
              />
              <Toggle
                checked={true}
                onChange={() => {}}
                label="In-app notifications"
                hint="Placeholder toggle."
              />
            </div>
          </Card>

          <Card title="Danger zone">
            <div className="text-sm text-slate-700">
              Placeholder actions for account deactivation / data export. Keep behind confirmations.
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => alert("Download my data (demo).")}
                className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Download my data
              </button>
              <button
                type="button"
                onClick={() => alert("Deactivate account (demo).")}
                className="rounded-2xl bg-rose-600 text-white px-4 py-2 text-sm hover:bg-rose-500"
              >
                Deactivate account
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
