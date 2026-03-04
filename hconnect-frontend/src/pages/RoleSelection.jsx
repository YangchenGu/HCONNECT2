import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api.js";

export default function RoleSelection() {
  const { user, getAccessTokenSilently, loginWithRedirect, isAuthenticated } = useAuth0();
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
        loginWithRedirect();
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-center text-gray-600 mb-6">Please select your role to continue</p>

        <div className="space-y-4">
          <button
            onClick={() => setRole("doctor")}
            className={`w-full p-5 rounded-xl border-2 text-left transition ${role === "doctor" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
          >
            <div className="text-xl mb-1">👨‍⚕️ Doctor</div>
            <div className="text-sm text-gray-600">Healthcare professional</div>
          </button>

          <button
            onClick={() => setRole("patient")}
            className={`w-full p-5 rounded-xl border-2 text-left transition ${role === "patient" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
          >
            <div className="text-xl mb-1">🧑‍🤝‍🧑 Patient</div>
            <div className="text-sm text-gray-600">Receiving care</div>
          </button>
        </div>

        {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Continue"}
        </button>
      </div>
    </div>
  );
}