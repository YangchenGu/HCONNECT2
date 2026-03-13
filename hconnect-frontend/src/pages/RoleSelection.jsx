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
    <div className="min-h-screen bg-[linear-gradient(135deg,#110f24_0%,#161f3c_45%,#0d1a33_100%)] flex items-center justify-center p-4">
      <div className="rounded-2xl border border-slate-400/25 bg-[#0f1730]/92 shadow-2xl p-8 w-full max-w-md backdrop-blur text-slate-100">
        <h1 className="text-2xl font-bold text-center text-slate-100 mb-2">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-center text-slate-300 mb-6">Select which portal you want to continue with.</p>

        <div className="space-y-4">
          <button
            onClick={() => setRole("doctor")}
            className={`w-full p-5 rounded-xl border text-left transition ${role === "doctor" ? "border-blue-300/60 bg-blue-400/10" : "border-slate-500/30 hover:border-blue-300/50"}`}
          >
            <div className="text-xl mb-1">👨‍⚕️ Doctor</div>
            <div className="text-sm text-slate-300">Dark blue clinical workspace</div>
          </button>

          <button
            onClick={() => setRole("patient")}
            className={`w-full p-5 rounded-xl border text-left transition ${role === "patient" ? "border-violet-300/60 bg-violet-400/10" : "border-slate-500/30 hover:border-violet-300/50"}`}
          >
            <div className="text-xl mb-1">🧑‍🤝‍🧑 Patient</div>
            <div className="text-sm text-slate-300">Dark purple personal care portal</div>
          </button>
        </div>

        {error && <div className="mt-4 p-3 bg-rose-500/15 border border-rose-300/40 text-rose-200 rounded-lg text-sm">{error}</div>}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full mt-6 bg-slate-200/10 text-white py-3 rounded-lg font-semibold hover:bg-slate-200/20 border border-slate-500/40 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Continue"}
        </button>

      </div>
    </div>
  );
}