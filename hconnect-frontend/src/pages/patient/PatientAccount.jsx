import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

const APP_ORIGIN =
  import.meta.env.VITE_APP_ORIGIN ||
  (import.meta.env.DEV ? "http://localhost:5173" : window.location.origin);

export default function PatientAccount() {
  const { user, getAccessTokenSilently, logout } = useAuth0();
  const [name, setName] = useState(user?.name || "");
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState(null);

  useEffect(() => {
    const key = `patient_account_${user?.sub || "guest"}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      const snapshot = {
        name: user?.name || "",
        emailPref: true,
        smsPref: false,
      };
      setName(snapshot.name);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const snapshot = {
        name: parsed.name || user?.name || "",
        emailPref: Boolean(parsed.emailPref),
        smsPref: Boolean(parsed.smsPref),
      };
      setName(snapshot.name);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
    } catch {
      const snapshot = {
        name: user?.name || "",
        emailPref: true,
        smsPref: false,
      };
      setName(snapshot.name);
      setEmailPref(snapshot.emailPref);
      setSmsPref(snapshot.smsPref);
      setSavedSnapshot(snapshot);
    }
  }, [user?.name, user?.sub]);

  async function loadMatchRequests() {
    setRequestLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl("/api/patient/match-requests"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load match requests");
      }
      setIncomingRequests(payload.requests || []);
    } catch (error) {
      setMsgType("error");
      setMsg(error.message || "Failed to load match requests");
    } finally {
      setRequestLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.sub) return;
    loadMatchRequests();
  }, [user?.sub]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return (
      name.trim() !== savedSnapshot.name ||
      emailPref !== savedSnapshot.emailPref ||
      smsPref !== savedSnapshot.smsPref
    );
  }, [name, emailPref, smsPref, savedSnapshot]);

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

  function save(e) {
    e.preventDefault();
    if (!canSave) return;
    const snapshot = { name: name.trim(), emailPref, smsPref };
    localStorage.setItem(
      `patient_account_${user?.sub || "guest"}`,
      JSON.stringify(snapshot)
    );
    setSavedSnapshot(snapshot);
    setIsEditing(false);
    setMsgType("success");
    setMsg("Account preferences saved.");
    setTimeout(() => setMsg(""), 2200);
  }

  function cancelEditing() {
    if (isDirty) {
      const ok = window.confirm("Discard your unsaved changes?");
      if (!ok) return;
    }
    if (savedSnapshot) {
      setName(savedSnapshot.name);
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

  async function respondToRequest(requestId, action) {
    setRequestBusyId(requestId);
    setMsg("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/patient/match-requests/${requestId}/respond`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to respond to request");
      }
      setMsgType("success");
      setMsg(action === "accept" ? "Doctor matched successfully." : "Request rejected.");
      await loadMatchRequests();
    } catch (error) {
      setMsgType("error");
      setMsg(error.message || "Failed to respond to request");
    } finally {
      setRequestBusyId(null);
    }
  }

  return (
    <div className="p-6 text-violet-100">
      <form onSubmit={save} className="max-w-2xl rounded-2xl border border-violet-300/15 bg-violet-900/30 p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Account settings</h2>

        <div className="rounded-xl border border-blue-300/25 bg-[#0f1f3f] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-blue-200/90">Pending doctor match requests</div>
            <button
              type="button"
              onClick={loadMatchRequests}
              disabled={requestLoading || Boolean(requestBusyId)}
              className="rounded-lg border border-blue-300/30 bg-blue-900/30 px-2 py-1 text-[11px] text-blue-100 hover:bg-blue-800/50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {incomingRequests.length ? (
            <div className="space-y-2">
              {incomingRequests.map((request) => {
                const busy = requestBusyId === request.RequestID;
                return (
                  <div key={request.RequestID} className="rounded-lg border border-blue-300/20 bg-[#13264d] px-3 py-2">
                    <div className="text-sm text-blue-100 font-medium">{request.doctor_name || "Doctor"}</div>
                    <div className="text-xs text-blue-300/90 break-all">{request.doctor_email}</div>
                    {request.message ? (
                      <div className="mt-1 text-xs text-blue-200/85">Message: {request.message}</div>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToRequest(request.RequestID, "accept")}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-3 py-1.5"
                      >
                        {busy ? "Working..." : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondToRequest(request.RequestID, "reject")}
                        className="rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs px-3 py-1.5"
                      >
                        {busy ? "Working..." : "Reject"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-blue-200/80">
              {requestLoading ? "Loading requests..." : "No pending requests."}
            </div>
          )}
        </div>

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
              <div className="text-blue-100 break-all">{user?.email || "Not available"}</div>
            </div>
            <div>
              <div className="text-[11px] text-blue-300/75">Phone</div>
              <div className="text-blue-100">{user?.phone_number || "Not provided"}</div>
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
      </form>
    </div>
  );
}
