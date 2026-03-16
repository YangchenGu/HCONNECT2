import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api.js";

export default function RoleSelection() {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setError("");
    if (!role) return setError("Please select a role.");

    // If user not authenticated: route to appropriate auth flow
    if (!isAuthenticated) {
      if (role === "doctor") {
        navigate("/doctor/entry");
      } else {
        navigate("/patient/entry");
      }
      return;
    }

    // Authenticated: proceed with patient registration or doctor flow
    if (role === "doctor") {
      navigate("/doctor/entry");
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessTokenSilently({ audience: "https://hconnect-api" });
      const rres = await fetch(apiUrl("/api/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth0_id: user.sub,
          email: user.email,
          name: user.name,
          role,
        }),
      });
      if (!rres.ok) {
        const payload = await rres.json().catch(() => ({}));
        throw new Error(payload.error || "Registration failed");
      }
      localStorage.setItem(`user_role_${user.sub}`, role);
      navigate("/");
    } catch (e) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_20%,rgba(14,165,233,0.16)_0%,transparent_35%),radial-gradient(circle_at_80%_14%,rgba(20,184,166,0.16)_0%,transparent_32%),linear-gradient(135deg,#081225_0%,#0c1933_42%,#0a1b30_100%)] flex items-center justify-center p-4">
      <div className="rounded-3xl border border-cyan-300/25 bg-[#0b152b]/92 shadow-[0_20px_80px_rgba(3,7,18,0.55)] p-6 md:p-8 w-full max-w-3xl backdrop-blur text-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-cyan-400/15 border border-cyan-300/30 grid place-items-center text-xl">🧬</div>
          <div>
            <div className="text-2xl font-bold text-white">Hconnect</div>
            <div className="text-xs text-cyan-200/80 tracking-[0.22em] uppercase">Connected Care Network</div>
          </div>
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-white">Welcome</h1>
        <p className="mt-1 text-sm text-slate-300">Choose your workspace to continue secure care coordination and health tracking.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] border border-cyan-300/35 bg-cyan-300/10 text-cyan-100">Protected Health Data</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] border border-emerald-300/35 bg-emerald-300/10 text-emerald-100">Clinical Collaboration</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] border border-sky-300/35 bg-sky-300/10 text-sky-100">Appointment Management</span>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <button
              onClick={() => setRole("doctor")}
              className={`w-full p-5 rounded-2xl border text-left transition ${role === "doctor" ? "border-cyan-300/65 bg-cyan-300/14 shadow-[0_8px_26px_rgba(34,211,238,0.18)]" : "border-slate-500/30 hover:border-cyan-300/50"}`}
            >
              <div className="text-xl mb-1">👨‍⚕️ Doctor Workspace</div>
              <div className="text-sm text-slate-300">Manage patient panels, review reports, issue advice, and coordinate appointments.</div>
            </button>

            <button
              onClick={() => setRole("patient")}
              className={`w-full p-5 rounded-2xl border text-left transition ${role === "patient" ? "border-emerald-300/65 bg-emerald-300/14 shadow-[0_8px_26px_rgba(16,185,129,0.18)]" : "border-slate-500/30 hover:border-emerald-300/50"}`}
            >
              <div className="text-xl mb-1">🧑‍🤝‍🧑 Patient Workspace</div>
              <div className="text-sm text-slate-300">Track daily health metrics, book visits, and receive clinical guidance from your care team.</div>
            </button>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-500/30 bg-slate-900/35 p-4">
            <div className="text-sm font-semibold text-white">What you can do in Hconnect</div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>• Maintain a unified doctor-patient relationship timeline</li>
              <li>• Exchange medical advice with acknowledgment tracking</li>
              <li>• Monitor report trends and clinical follow-up actions</li>
              <li>• Keep appointments and notifications in one workflow</li>
            </ul>
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-rose-500/15 border border-rose-300/40 text-rose-200 rounded-lg text-sm">{error}</div>}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full mt-6 bg-cyan-500/20 text-cyan-50 py-3 rounded-xl font-semibold hover:bg-cyan-500/30 border border-cyan-300/45 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Continue to Hconnect"}
        </button>
      </div>
    </div>
  );
}