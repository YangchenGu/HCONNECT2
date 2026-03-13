import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function PatientEntry() {
  const { loginWithRedirect, isLoading } = useAuth0();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,#1e3a6b_0%,#13284b_35%,#0b162d_100%)] text-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-blue-300/30 bg-[#102445]/92 backdrop-blur p-8 shadow-2xl shadow-black/50">
        <div className="inline-flex rounded-full border border-blue-300/35 bg-blue-900/50 px-3 py-1 text-xs tracking-wide text-blue-100">
          HCONNECT PATIENT PORTAL
        </div>

        <h1 className="mt-4 text-3xl font-semibold text-white">Welcome to your care space</h1>
        <p className="mt-2 text-sm text-blue-100/85">
          Sign in if you already have an account, or create a patient account to access your health dashboard, reports,
          and appointments.
        </p>

        <div className="mt-7 grid gap-3">
          <button
            onClick={() =>
              loginWithRedirect({
                authorizationParams: {
                  screen_hint: "login",
                  prompt: "login",
                  max_age: 0,
                },
              })
            }
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-500/90 hover:bg-blue-400 text-white font-semibold py-3 transition disabled:opacity-50"
          >
            Sign in as patient
          </button>

          <button
            onClick={() => navigate("/patient/register")}
            disabled={isLoading}
            className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 hover:bg-blue-900/65 text-blue-100 font-semibold py-3 transition disabled:opacity-50"
          >
            Create patient account
          </button>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-6 text-sm text-blue-200/90 hover:text-blue-100 underline underline-offset-4"
        >
          Back
        </button>
      </div>
    </div>
  );
}
