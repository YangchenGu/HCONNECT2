import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function DoctorEntry() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_20%_10%,#2f2758_0%,#1b1640_45%,#100c24_100%)] p-4">
      <div className="w-full max-w-lg rounded-2xl border border-violet-300/28 bg-[#171133]/92 p-8 shadow-2xl shadow-black/50 text-slate-100">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-400/15 text-blue-200 mb-4">
          DOCTOR PORTAL
        </span>
        <h2 className="text-2xl font-semibold mb-2 text-slate-100">Doctor Access</h2>
        <p className="text-sm text-slate-300 mb-6">Login or register a doctor account with provider phone verification.</p>

        <div className="space-y-3">
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
            className="w-full py-3 bg-blue-500/90 text-white rounded-lg font-semibold hover:bg-blue-400"
          >
            I already have an account — Login
          </button>

          <button
            onClick={() => navigate("/register")}
            className="w-full py-3 border border-blue-300/40 text-blue-100 rounded-lg font-semibold hover:bg-blue-400/10"
          >
            Register as doctor (verify phone first)
          </button>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-6 w-full py-2 text-sm text-slate-300"
        >
          Back
        </button>
      </div>
    </div>
  );
}
