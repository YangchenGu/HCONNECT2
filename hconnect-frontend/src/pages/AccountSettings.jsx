import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Card from "../components/Card.jsx";
import { accountProfileDefaults, securityDefaults } from "../data/account_settings.js";
import { apiUrl } from "../lib/api.js";

const APP_ORIGIN =
  import.meta.env.VITE_APP_ORIGIN ||
  (import.meta.env.DEV ? "http://localhost:5173" : window.location.origin);

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          onChange(!checked);
        }}
        disabled={disabled}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition",
          checked ? "bg-slate-900" : "bg-slate-300",
          disabled ? "opacity-60 cursor-not-allowed" : "",
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
  const { user, logout, getAccessTokenSilently } = useAuth0();
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
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const storageKey = useMemo(() => `account_settings_${user?.sub || "guest"}`, [user?.sub]);

  useEffect(() => {
    const baseProfile = {
      ...accountProfileDefaults,
      fullName: user?.name || accountProfileDefaults.fullName,
      email: user?.email || accountProfileDefaults.email,
      phone: user?.phone_number || accountProfileDefaults.phone,
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

    return errors;
  }, [profile]);

  const isDirty = useMemo(() => {
    return JSON.stringify({ profile, security, preferences }) !== JSON.stringify(savedSnapshot);
  }, [profile, security, preferences, savedSnapshot]);

  const canSave = useMemo(() => {
    return isEditing && Object.keys(validation).length === 0 && isDirty;
  }, [validation, isDirty]);

  useEffect(() => {
    if (!(isEditing && isDirty)) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handleAnchorNavigation = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      const targetUrl = new URL(anchor.href, window.location.origin);
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      if (current === next) return;

      const ok = window.confirm("You have unsaved changes. Discard and leave this page?");
      if (!ok) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleAnchorNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorNavigation, true);
    };
  }, [isEditing, isDirty]);

  function saveProfile(e) {
    e.preventDefault();
    if (!canSave) return;
    const snapshot = { profile, security, preferences };
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    setSavedSnapshot(snapshot);
    setIsEditing(false);
    setStatusType("success");
    setStatusMsg("Account settings saved successfully.");
    setTimeout(() => setStatusMsg(""), 2500);
  }

  function startEditing() {
    setStatusMsg("");
    setIsEditing(true);
  }

  function changePassword() {
    setStatusType("info");
    setStatusMsg("Password changes are managed by Auth0. Use the login page 'Forgot password' flow.");
    setTimeout(() => setStatusMsg(""), 3500);
  }

  function logoutEverywhere() {
    logout({ logoutParams: { returnTo: APP_ORIGIN } });
  }

  function resetToLastSaved() {
    if (isDirty) {
      const ok = window.confirm("Discard your unsaved changes?");
      if (!ok) return;
    }
    setProfile(savedSnapshot.profile);
    setSecurity(savedSnapshot.security);
    setPreferences(savedSnapshot.preferences);
    setIsEditing(false);
    setStatusType("info");
    setStatusMsg("Changes reverted to last saved state.");
    setTimeout(() => setStatusMsg(""), 1800);
  }

  async function deleteAccountData() {
    const ok = window.confirm("This will permanently delete your account data and sign you out. Continue?");
    if (!ok) return;

    setDeleteLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/account"), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || payload.message || "Failed to delete account data");
      }

      localStorage.removeItem(storageKey);
      localStorage.removeItem(`user_role_${user?.sub}`);

      logout({ logoutParams: { returnTo: APP_ORIGIN } });
    } catch (error) {
      setStatusType("error");
      setStatusMsg(error.message || "Failed to delete account data.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900">Account Settings</div>
        <div className="text-xs text-slate-500 mt-1">Manage profile, security, and preferences.</div>
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
            <SectionTitle title="Account identity" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-2xl bg-[#16112d] ring-1 ring-violet-300/20 px-3 py-2">
                <div className="text-xs text-slate-500 mb-1">Role</div>
                <div className="text-sm text-slate-900">{profile.role || "doctor"}</div>
              </div>
              <div className="rounded-2xl bg-[#16112d] ring-1 ring-violet-300/20 px-3 py-2 md:col-span-2">
                <div className="text-xs text-slate-500 mb-1">Email</div>
                <div className="text-sm text-slate-900 break-all">{profile.email || "Not available"}</div>
              </div>
              <div className="rounded-2xl bg-[#16112d] ring-1 ring-violet-300/20 px-3 py-2 md:col-span-3">
                <div className="text-xs text-slate-500 mb-1">Phone</div>
                <div className="text-sm text-slate-900">{profile.phone || "Not provided"}</div>
              </div>
            </div>

            

            <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs text-slate-500 mb-1">Full name</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none focus:ring-black/10"
                  value={profile.fullName}
                  disabled={!isEditing}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                />
                {validation.fullName ? <div className="mt-1 text-xs text-rose-600">{validation.fullName}</div> : null}
              </label>

              <label>
                <div className="text-xs text-slate-500 mb-1">Clinic</div>
                <input
                  className="w-full rounded-2xl bg-white ring-1 ring-black/5 px-3 py-2 text-sm outline-none"
                  value={profile.clinic}
                  disabled={!isEditing}
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
                  disabled={!isEditing}
                  className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Upload
                </button>
              </div>
            </form>
            <div className="flex gap-2 mb-3">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={resetToLastSaved}
                    className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
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
                </>
              )}
            </div>
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
                disabled={!isEditing}
                label="Two-factor authentication (2FA)"
                hint="Placeholder: enable/disable 2FA."
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={!isEditing}
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
                disabled={!isEditing}
                label="Email updates"
                hint="Receive account and activity updates by email."
              />
              <Toggle
                checked={preferences.smsUpdates}
                onChange={(v) => setPreferences((prev) => ({ ...prev, smsUpdates: v }))}
                disabled={!isEditing}
                label="SMS updates"
                hint="Receive urgent alerts via SMS."
              />
              <Toggle
                checked={preferences.inAppNotifications}
                onChange={(v) => setPreferences((prev) => ({ ...prev, inAppNotifications: v }))}
                disabled={!isEditing}
                label="In-app notifications"
                hint="Show notifications in the app feed."
              />
            </div>
          </Card>

          <Card title="Danger zone">
            <div className="text-sm text-slate-700">Sensitive actions. Use with caution.</div>

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
                onClick={deleteAccountData}
                disabled={deleteLoading}
                className="rounded-2xl bg-rose-600 text-white px-4 py-2 text-sm hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting account..." : "Delete account data and sign out"}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
