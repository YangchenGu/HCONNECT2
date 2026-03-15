import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../../lib/api.js";

function urgencyLabel(value) {
  const norm = String(value || "").toLowerCase();
  if (norm === "urgent") return "Urgent";
  if (norm === "low") return "Not Urgent";
  return "Normal";
}

function urgencyClass(value) {
  const norm = String(value || "").toLowerCase();
  if (norm === "urgent") return "border-rose-400/40 bg-rose-500/15 text-rose-200";
  if (norm === "low") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  return "border-amber-400/40 bg-amber-500/15 text-amber-200";
}

export default function PatientAdvice() {
  const { getAccessTokenSilently } = useAuth0();
  const [advices, setAdvices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 5, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [busyAdviceId, setBusyAdviceId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  async function loadAdvices(nextPage = 1) {
    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/patient/advices?limit=5&page=${nextPage}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load medical advice");
      setAdvices(payload.advices || []);
      setPagination(payload.pagination || { page: 1, limit: 5, total: 0, pages: 1 });
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load medical advice");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdvices(1);
  }, []);

  async function acknowledgeAdvice(adviceId) {
    setBusyAdviceId(adviceId);
    setMessage("");
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const res = await fetch(apiUrl(`/api/patient/advices/${adviceId}/acknowledge`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to acknowledge advice");

      setMessageType("success");
      setMessage("Advice confirmed as received.");
      await loadAdvices(pagination.page);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to acknowledge advice");
    } finally {
      setBusyAdviceId(null);
    }
  }

  return (
    <div className="p-6 text-blue-100 space-y-4">
      <div className="rounded-2xl border border-blue-300/15 bg-blue-900/25 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Medical Advice History</h2>
          <button
            type="button"
            onClick={() => loadAdvices(pagination.page)}
            disabled={loading || Boolean(busyAdviceId)}
            className="rounded-lg border border-blue-300/30 bg-blue-800/40 hover:bg-blue-800/60 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {!loading && !advices.length ? <div className="text-sm text-blue-300/80">No medical advice yet.</div> : null}

          {advices.map((advice) => {
            const busy = busyAdviceId === advice.AdviceID;
            const acknowledged = Boolean(advice.is_acknowledged);
            return (
              <article key={advice.AdviceID} className="rounded-xl border border-blue-300/15 bg-[#12203c] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{advice.doctor_name || "Doctor"}</div>
                    <div className="text-xs text-blue-300/85 break-all">{advice.doctor_email || ""}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${urgencyClass(advice.urgency)}`}>
                    {urgencyLabel(advice.urgency)}
                  </span>
                </div>

                <div className="mt-3 text-sm text-blue-100 whitespace-pre-wrap">{advice.content}</div>

                <div className="mt-3 text-xs text-blue-300/80">
                  Sent: {new Date(advice.created_at).toLocaleString()}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {acknowledged ? (
                    <div className="text-xs text-emerald-300">
                      Confirmed received at {advice.acknowledged_at ? new Date(advice.acknowledged_at).toLocaleString() : "-"}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => acknowledgeAdvice(advice.AdviceID)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs text-white"
                    >
                      {busy ? "Working..." : "Confirm received"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-blue-300/85">
            Page {pagination.page} / {pagination.pages} ({pagination.total} advices)
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadAdvices(Math.max(1, pagination.page - 1))}
              disabled={loading || pagination.page <= 1}
              className="rounded-xl px-3 py-2 border border-blue-300/20 bg-blue-900/35 hover:bg-blue-900/50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => loadAdvices(Math.min(pagination.pages, pagination.page + 1))}
              disabled={loading || pagination.page >= pagination.pages}
              className="rounded-xl px-3 py-2 border border-blue-300/20 bg-blue-900/35 hover:bg-blue-900/50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-blue-300/80">Loading advice...</div> : null}
      {message ? <div className={`text-sm ${messageType === "error" ? "text-rose-300" : "text-emerald-300"}`}>{message}</div> : null}
    </div>
  );
}
