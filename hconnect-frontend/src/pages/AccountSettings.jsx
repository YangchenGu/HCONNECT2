import React, { useEffect, useMemo, useRef, useState } from "react";
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

function formatSecurityTime(value) {
  if (!value || value === "Not available") return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatPhoneWithCountry(phone, country) {
  const trimmedPhone = String(phone || "").trim();
  const trimmedCountry = String(country || "").trim().toUpperCase();
  if (!trimmedPhone) return "Not provided";
  if (!trimmedCountry) return trimmedPhone;
  return `${trimmedCountry} ${trimmedPhone}`;
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
  const { user, logout, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(accountProfileDefaults);
  const [security, setSecurity] = useState(securityDefaults);
  const [preferences, setPreferences] = useState({
    emailUpdates: true,
    smsUpdates: false,
    inAppNotifications: true,
  });
  const [savedSnapshot, setSavedSnapshot] = useState({
    profile: accountProfileDefaults,
    preferences: {
      emailUpdates: true,
      smsUpdates: false,
      inAppNotifications: true,
    },
  });
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState("success");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
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
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
        },
      };
      setProfile(fresh.profile);
      setPreferences(fresh.preferences);
      setSavedSnapshot(fresh);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const hydrated = {
        profile: { ...baseProfile, ...(parsed.profile || {}) },
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
          ...(parsed.preferences || {}),
        },
      };
      setProfile(hydrated.profile);
      setPreferences(hydrated.preferences);
      setSavedSnapshot(hydrated);
    } catch {
      const fallback = {
        profile: baseProfile,
        preferences: {
          emailUpdates: true,
          smsUpdates: false,
          inAppNotifications: true,
        },
      };
      setProfile(fallback.profile);
      setPreferences(fallback.preferences);
      setSavedSnapshot(fallback);
    }
  }, [storageKey, user?.email, user?.name]);

  useEffect(() => {
    async function loadSecurityInfo() {
      if (!isAuthenticated) return;

      setSecurityLoading(true);
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/account/security"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Failed to load security information");

        setProfile((prev) => ({
          ...prev,
          fullName: payload.name || prev.fullName,
          email: payload.email || prev.email,
          phone: payload.phone || prev.phone,
          country: payload.country || prev.country,
        }));

        setSecurity({
          lastLogin: payload.lastLogin || "Not available",
          lastPasswordChange: payload.lastPasswordChange || "Not available",
        });
      } catch (error) {
        setSecurity(securityDefaults);
        setStatusType("error");
        setStatusMsg(error.message || "Failed to load security information.");
      } finally {
        setSecurityLoading(false);
      }
    }

    loadSecurityInfo();
  }, [isAuthenticated, getAccessTokenSilently]);

  const validation = useMemo(() => {
    const errors = {};

    if (!profile.fullName.trim() || profile.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    }

    return errors;
  }, [profile]);

  const isDirty = useMemo(() => {
    return JSON.stringify({ profile, preferences }) !== JSON.stringify(savedSnapshot);
  }, [profile, preferences, savedSnapshot]);

  const canSave = useMemo(() => {
    return isEditing && Object.keys(validation).length === 0 && isDirty;
  }, [validation, isDirty]);

  function triggerAvatarPicker() {
    if (!isEditing) return;
    fileInputRef.current?.click();
  }

  function handleAvatarSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatusType("error");
      setStatusMsg("Please upload an image file.");
      return;
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setStatusType("error");
      setStatusMsg("Image is too large. Please keep it under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = typeof reader.result === "string" ? reader.result : "";
      if (!nextAvatar) return;
      setProfile((prev) => ({ ...prev, avatarDataUrl: nextAvatar }));
      setStatusType("success");
      setStatusMsg("Avatar selected. Click Save to apply it.");
    };
    reader.onerror = () => {
      setStatusType("error");
      setStatusMsg("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    if (!isEditing) return;
    setProfile((prev) => ({ ...prev, avatarDataUrl: "" }));
    setStatusType("info");
    setStatusMsg("Avatar removed. Click Save to apply this change.");
  }

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
    const snapshot = { profile, preferences };
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    window.dispatchEvent(new Event("hconnect-account-settings-updated"));
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

  async function changePassword() {
    setPasswordResetLoading(true);
    setStatusMsg("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/account/password-reset-email"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to send password reset email");

      setStatusType("success");
      setStatusMsg("Password reset email sent. Please check your inbox.");
      setTimeout(() => setStatusMsg(""), 3500);
    } catch (error) {
      setStatusType("error");
      setStatusMsg(error.message || "Failed to send password reset email.");
    } finally {
      setPasswordResetLoading(false);
    }
  }

  function resetToLastSaved() {
    if (isDirty) {
      const ok = window.confirm("Discard your unsaved changes?");
      if (!ok) return;
    }
    setProfile(savedSnapshot.profile);
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
                <div className="text-sm text-slate-900">{formatPhoneWithCountry(profile.phone, profile.country)}</div>
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
                  <div className="text-xs text-slate-500 mt-1">Upload a profile photo shown in the left sidebar.</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl overflow-hidden ring-1 ring-black/10 bg-slate-200 grid place-items-center">
                    {profile.avatarDataUrl ? (
                      <img src={profile.avatarDataUrl} alt="Doctor avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">👨‍⚕️</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelected}
                  />
                  <button
                    type="button"
                    onClick={triggerAvatarPicker}
                    disabled={!isEditing}
                    className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {profile.avatarDataUrl ? "Change" : "Upload"}
                  </button>
                  <button
                    type="button"
                    onClick={removeAvatar}
                    disabled={!isEditing || !profile.avatarDataUrl}
                    className="rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
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
              subtitle="Security information is synced from Auth0."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
                <div className="text-xs text-slate-500">Last login</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{securityLoading ? "Loading..." : formatSecurityTime(security.lastLogin)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 ring-1 ring-black/5 p-4">
                <div className="text-xs text-slate-500">Last password change</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{securityLoading ? "Loading..." : formatSecurityTime(security.lastPasswordChange)}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={passwordResetLoading}
                  className="flex-1 rounded-2xl bg-white ring-1 ring-black/5 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {passwordResetLoading ? "Sending..." : "Send password reset email"}
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
