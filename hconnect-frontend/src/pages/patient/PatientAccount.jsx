import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

const APP_ORIGIN =
  import.meta.env.VITE_APP_ORIGIN ||
  (import.meta.env.DEV ? "http://localhost:5173" : window.location.origin);

function formatPhoneWithCountry(phone, country) {
  const trimmedPhone = String(phone || "").trim();
  const trimmedCountry = String(country || "").trim().toUpperCase();
  if (!trimmedPhone) return "Not provided";
  if (!trimmedCountry) return trimmedPhone;
  return `${trimmedCountry} ${trimmedPhone}`;
}

export default function PatientAccount() {
  const { user, getAccessTokenSilently, logout } = useAuth0();
  const [name, setName] = useState(user?.name || "");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [identity, setIdentity] = useState({
    email: user?.email || "",
    phone: user?.phone_number || "",
    country: "",
  });
  const bloodTypeOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    const key = `patient_account_${user?.sub || "guest"}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      const snapshot = {
        name: user?.name || "",
        heightCm: "",
        weightKg: "",
        bloodType: "",
        address: "",
        emergencyContact: "",
        emailPref: true,
        smsPref: false,
      };
      setName(snapshot.name);
      setHeightCm(snapshot.heightCm);
      setWeightKg(snapshot.weightKg);
      setBloodType(snapshot.bloodType);
      setAddress(snapshot.address);
      setEmergencyContact(snapshot.emergencyContact);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const snapshot = {
        name: parsed.name || user?.name || "",
        heightCm: String(parsed.heightCm || ""),
        weightKg: String(parsed.weightKg || ""),
        bloodType: parsed.bloodType || "",
        address: parsed.address || "",
        emergencyContact: parsed.emergencyContact || "",
        emailPref: Boolean(parsed.emailPref),
        smsPref: Boolean(parsed.smsPref),
      };
      setName(snapshot.name);
      setHeightCm(snapshot.heightCm);
      setWeightKg(snapshot.weightKg);
      setBloodType(snapshot.bloodType);
      setAddress(snapshot.address);
      setEmergencyContact(snapshot.emergencyContact);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
    } catch {
      const snapshot = {
        name: user?.name || "",
        heightCm: "",
        weightKg: "",
        bloodType: "",
        address: "",
        emergencyContact: "",
        emailPref: true,
        smsPref: false,
      };
      setName(snapshot.name);
      setHeightCm(snapshot.heightCm);
      setWeightKg(snapshot.weightKg);
      setBloodType(snapshot.bloodType);
      setAddress(snapshot.address);
      setEmergencyContact(snapshot.emergencyContact);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
    }
  }, [user?.name, user?.sub]);

  useEffect(() => {
    if (!user?.sub) return;

    async function loadPatientProfile() {
      setProfileLoading(true);
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/patient/profile"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Failed to load patient profile");
        }

        const profile = payload.profile || {};
        const snapshot = {
          name: profile.display_name || user?.name || "",
          heightCm: profile.height_cm === null || profile.height_cm === undefined ? "" : String(profile.height_cm),
          weightKg: profile.weight_kg === null || profile.weight_kg === undefined ? "" : String(profile.weight_kg),
          bloodType: profile.blood_type || "",
          address: profile.address || "",
          emergencyContact: profile.emergency_contact || "",
          emailPref,
          smsPref,
        };

        setName(snapshot.name);
        setHeightCm(snapshot.heightCm);
        setWeightKg(snapshot.weightKg);
        setBloodType(snapshot.bloodType);
        setAddress(snapshot.address);
        setEmergencyContact(snapshot.emergencyContact);
        setSavedSnapshot((prev) => ({
          ...(prev || {}),
          ...snapshot,
        }));

        localStorage.setItem(`patient_account_${user?.sub || "guest"}`, JSON.stringify({
          ...(savedSnapshot || {}),
          ...snapshot,
        }));
      } catch (error) {
        setMsgType("error");
        setMsg(error.message || "Failed to load patient profile");
      } finally {
        setProfileLoading(false);
      }
    }

    loadPatientProfile();
  }, [user?.sub]);

  useEffect(() => {
    if (!user?.sub) return;

    async function loadIdentity() {
      try {
        const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
        const res = await fetch(apiUrl("/api/account/security"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Failed to load account identity");
        }

        setIdentity({
          email: payload.email || user?.email || "",
          phone: payload.phone || user?.phone_number || "",
          country: payload.country || "",
        });
      } catch {
        setIdentity({
          email: user?.email || "",
          phone: user?.phone_number || "",
          country: "",
        });
      }
    }

    loadIdentity();
  }, [user?.sub, user?.email, user?.phone_number, getAccessTokenSilently]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return (
      name.trim() !== savedSnapshot.name ||
      String(heightCm).trim() !== String(savedSnapshot.heightCm || "") ||
      String(weightKg).trim() !== String(savedSnapshot.weightKg || "") ||
      String(bloodType).trim() !== String(savedSnapshot.bloodType || "") ||
      String(address).trim() !== String(savedSnapshot.address || "") ||
      String(emergencyContact).trim() !== String(savedSnapshot.emergencyContact || "") ||
      emailPref !== savedSnapshot.emailPref ||
      smsPref !== savedSnapshot.smsPref
    );
  }, [name, heightCm, weightKg, bloodType, address, emergencyContact, emailPref, smsPref, savedSnapshot]);

  const canSave = useMemo(() => isEditing && name.trim().length >= 2 && isDirty, [isEditing, name, isDirty]);

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

  async function save(e) {
    e.preventDefault();
    if (!canSave) return;
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          heightCm: heightCm.trim(),
          weightKg: weightKg.trim(),
          bloodType: bloodType.trim(),
          address: address.trim(),
          emergencyContact: emergencyContact.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to save profile");
      }

      const profile = payload.profile || {};
      const snapshot = {
        name: name.trim(),
        heightCm: profile.height_cm === null || profile.height_cm === undefined ? "" : String(profile.height_cm),
        weightKg: profile.weight_kg === null || profile.weight_kg === undefined ? "" : String(profile.weight_kg),
        bloodType: profile.blood_type || "",
        address: profile.address || "",
        emergencyContact: profile.emergency_contact || "",
        emailPref,
        smsPref,
      };

      setName(snapshot.name);
      setHeightCm(snapshot.heightCm);
      setWeightKg(snapshot.weightKg);
      setBloodType(snapshot.bloodType);
      setAddress(snapshot.address);
      setEmergencyContact(snapshot.emergencyContact);
      localStorage.setItem(`patient_account_${user?.sub || "guest"}`, JSON.stringify(snapshot));
      setSavedSnapshot(snapshot);
      setIsEditing(false);
      setMsgType("success");
      setMsg("Account profile saved.");
      setTimeout(() => setMsg(""), 2200);
    } catch (error) {
      setMsgType("error");
      setMsg(error.message || "Failed to save profile");
    }
  }

  function cancelEditing() {
    if (isDirty) {
      const ok = window.confirm("Discard your unsaved changes?");
      if (!ok) return;
    }
    if (savedSnapshot) {
      setName(savedSnapshot.name);
      setHeightCm(savedSnapshot.heightCm || "");
      setWeightKg(savedSnapshot.weightKg || "");
      setBloodType(savedSnapshot.bloodType || "");
      setAddress(savedSnapshot.address || "");
      setEmergencyContact(savedSnapshot.emergencyContact || "");
      setEmailPref(savedSnapshot.emailPref);
      setSmsPref(savedSnapshot.smsPref);
    }
    setIsEditing(false);
    setMsgType("info");
    setMsg("Changes reverted to last saved state.");
    setTimeout(() => setMsg(""), 1800);
  }

  async function deleteAccountData() {
    const confirmed = window.confirm(
      "This will delete your account data for testing and sign you out. Continue?"
    );
    if (!confirmed) return;

    setDangerLoading(true);
    setMsgType("success");
    setMsg("");
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
        throw new Error(payload.error || payload.message || "Failed to delete account");
      }

      localStorage.removeItem(`user_role_${user?.sub}`);
      localStorage.removeItem(`patient_account_${user?.sub || "guest"}`);
      localStorage.removeItem("patient_daily_report");
      localStorage.removeItem("patient_appointment_request");

      logout({ logoutParams: { returnTo: APP_ORIGIN } });
    } catch (error) {
      setMsgType("error");
      setMsg(error.message || "Failed to delete account");
    } finally {
      setDangerLoading(false);
    }
  }

  return (
    <div className="p-6 text-violet-100">
      <form onSubmit={save} className="max-w-2xl rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Account settings</h2>

        <div className="flex gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setMsg("");
                setIsEditing(true);
              }}
              className="rounded-xl border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 text-violet-100 px-4 py-2 text-sm"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-xl border border-violet-300/30 bg-violet-800/40 hover:bg-violet-800/60 text-violet-100 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white px-4 py-2 text-sm font-semibold"
              >
                Save
              </button>
            </>
          )}
        </div>

        <div className="rounded-xl border border-blue-300/25 bg-[#0f1f3f] p-3">
          <div className="text-xs text-blue-200/90 mb-2">Account identity</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[11px] text-blue-300/75">Email</div>
              <div className="text-blue-100 break-all">{identity.email || "Not available"}</div>
            </div>
            <div>
              <div className="text-[11px] text-blue-300/75">Phone</div>
              <div className="text-blue-100">{formatPhoneWithCountry(identity.phone, identity.country)}</div>
            </div>
          </div>
        </div>

        <label className="block">
          <div className="text-xs text-violet-300 mb-1">Display name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isEditing}
            className="w-full rounded-lg border border-violet-300/20 bg-[#1a1335] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
          />
        </label>

        <div className="rounded-xl border border-violet-300/20 bg-[#1a1335] p-3 space-y-3">
          <div className="text-xs text-violet-300">Medical profile</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-violet-300 mb-1">Height (cm)</div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-violet-300/20 bg-[#130f2d] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              />
            </label>

            <label className="block">
              <div className="text-xs text-violet-300 mb-1">Weight (kg)</div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                disabled={!isEditing}
                className="w-full rounded-lg border border-violet-300/20 bg-[#130f2d] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Blood type</div>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              disabled={!isEditing}
              className="w-full rounded-lg border border-violet-300/20 bg-[#130f2d] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
            >
              <option value="">Select blood type</option>
              {bloodTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Address</div>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isEditing}
              rows={2}
              className="w-full rounded-lg border border-violet-300/20 bg-[#130f2d] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
            />
          </label>

          <label className="block">
            <div className="text-xs text-violet-300 mb-1">Emergency contact</div>
            <input
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              disabled={!isEditing}
              placeholder="Name and phone"
              className="w-full rounded-lg border border-violet-300/20 bg-[#130f2d] px-3 py-2 text-violet-100 outline-none focus:border-violet-300/40"
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-lg border border-violet-300/15 bg-[#1a1335] px-3 py-2">
            <span className="text-sm">Email reminders</span>
            <input type="checkbox" checked={emailPref} disabled={!isEditing} onChange={(e) => setEmailPref(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-violet-300/15 bg-[#1a1335] px-3 py-2">
            <span className="text-sm">SMS reminders</span>
            <input type="checkbox" checked={smsPref} disabled={!isEditing} onChange={(e) => setSmsPref(e.target.checked)} />
          </label>
        </div>

        <div className="pt-2 border-t border-violet-300/15">
          <div className="text-xs text-rose-200 mb-2">Danger zone</div>
          <button
            type="button"
            onClick={deleteAccountData}
            disabled={dangerLoading}
            className="rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-50 text-rose-200 px-5 py-2.5 text-sm font-semibold transition"
          >
            {dangerLoading ? "Deleting account..." : "Delete account data and sign out"}
          </button>
        </div>

        {msg ? (
          <div className={`text-sm ${msgType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{msg}</div>
        ) : null}

        {profileLoading ? <div className="text-xs text-violet-300/80">Loading profile...</div> : null}
      </form>
    </div>
  );
}
