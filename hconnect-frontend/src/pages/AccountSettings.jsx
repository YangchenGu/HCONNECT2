import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
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
  const { user, logout } = useAuth0();
  const [profile, setProfile] = useState(accountProfileDefaults);
  const [security, setSecurity] = useState(securityDefaults);
  const [preferences, setPreferences] = useState({
    emailUpdates: true,
    smsUpdates: false,
    inAppNotifications: true,
  });
  const [savedSnapshot, setSavedSnapshot] = useState({
    profile: accountProfileDefaults,
    security: securityDefaults,
    preferences: {
      emailUpdates: true,
      smsUpdates: false,
      inAppNotifications: true,
    },
  });
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState("success");

  const storageKey = useMemo(() => `account_settings_${user?.sub || "guest"}`, [user?.sub]);

  useEffect(() => {
    const baseProfile = {
      ...accountProfileDefaults,
      fullName: user?.name || accountProfileDefaults.fullName,
      email: user?.email || accountProfileDefaults.email,
    };

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      const fresh = {
        profile: baseProfile,
        security: securityDefaults,
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
        },
      };
      setProfile(fresh.profile);
      setSecurity(fresh.security);
      setPreferences(fresh.preferences);
      setSavedSnapshot(fresh);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const hydrated = {
        profile: { ...baseProfile, ...(parsed.profile || {}) },
        security: { ...securityDefaults, ...(parsed.security || {}) },
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
          ...(parsed.preferences || {}),
        },
      };
      setProfile(hydrated.profile);
      setSecurity(hydrated.security);
      setPreferences(hydrated.preferences);
      setSavedSnapshot(hydrated);
    } catch {
      const fallback = {
        profile: baseProfile,
        security: securityDefaults,
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
        },
      };
      setProfile(fallback.profile);
      setSecurity(fallback.security);
      setPreferences(fallback.preferences);
      setSavedSnapshot(fallback);
    }
  }, [storageKey, user?.email, user?.name]);

  const validation = useMemo(() => {
    const errors = {};

    if (!profile.fullName.trim() || profile.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    }

    if (!profile.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    const phoneDigits = (profile.phone || "").replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 8 || phoneDigits.length > 15) {
      errors.phone = "Phone must contain 8-15 digits.";
    }

    return errors;
  }, [profile]);

  const isDirty = useMemo(() => {
    return JSON.stringify({ profile, security, preferences }) !== JSON.stringify(savedSnapshot);
  }, [profile, security, preferences, savedSnapshot]);

  const canSave = useMemo(() => {
    return Object.keys(validation).length === 0 && isDirty;
  }, [validation, isDirty]);

  function saveProfile(e) {
    e.preventDefault();
    if (!canSave) return;
    const snapshot = { profile, security, preferences };
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    setSavedSnapshot(snapshot);
    setStatusType("success");
    setStatusMsg("Account settings saved successfully.");
    setTimeout(() => setStatusMsg(""), 2500);
  }

  function changePassword() {
    setStatusType("info");
    setStatusMsg("Password changes are managed by Auth0. Use the login page 'Forgot password' flow.");
    setTimeout(() => setStatusMsg(""), 3500);
  }

  function logoutEverywhere() {
    logout({ logoutParams: { returnTo: window.location.origin } });
  }

  function resetToLastSaved() {
    setProfile(savedSnapshot.profile);
    setSecurity(savedSnapshot.security);
    setPreferences(savedSnapshot.preferences);
    setStatusType("info");
    setStatusMsg("Changes reverted to last saved state.");
    setTimeout(() => setStatusMsg(""), 1800);
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
            onClick={resetToLastSaved}
            className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
            disabled={!isDirty}
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
        <div
          className={[
            "rounded-2xl px-4 py-3 text-sm ring-1",
            statusType === "success"
              ? "bg-emerald-50 ring-emerald-200 text-emerald-900"
              : statusType === "info"
              ? "bg-blue-50 ring-blue-200 text-blue-900"
              : "bg-rose-50 ring-rose-200 text-rose-900",
          ].join(" ")}
        >
          {statusMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Profile">
            <SectionTitle title="Basic information" subtitle="These settings are stored per user on this device." />

            <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs text-slate-500 mb-1">Full name</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none focus:ring-black/10"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                />
                {validation.fullName ? <div className="mt-1 text-xs text-rose-600">{validation.fullName}</div> : null}
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
                {validation.email ? <div className="mt-1 text-xs text-rose-600">{validation.email}</div> : null}
              </label>

              <label>
                <div className="text-xs text-slate-500 mb-1">Phone</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
                {validation.phone ? <div className="mt-1 text-xs text-rose-600">{validation.phone}</div> : null}
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
                checked={preferences.emailUpdates}
                onChange={(v) => setPreferences((prev) => ({ ...prev, emailUpdates: v }))}
                label="Email updates"
                hint="Receive account and activity updates by email."
              />
              <Toggle
                checked={preferences.smsUpdates}
                onChange={(v) => setPreferences((prev) => ({ ...prev, smsUpdates: v }))}
                label="SMS updates"
                hint="Receive urgent alerts via SMS."
              />
              <Toggle
                checked={preferences.inAppNotifications}
                onChange={(v) => setPreferences((prev) => ({ ...prev, inAppNotifications: v }))}
                label="In-app notifications"
                hint="Show notifications in the app feed."
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
                onClick={() => {
                  const payload = {
                    profile,
                    security,
                    preferences,
                    exportedAt: new Date().toISOString(),
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "hconnect-account-settings.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Download my data
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm("Are you sure you want to deactivate this account? This is currently a local demo action.");
                  if (!ok) return;
                  localStorage.removeItem(storageKey);
                  setStatusType("info");
                  setStatusMsg("Account settings were cleared for this user on this device.");
                }}
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
