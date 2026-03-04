import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

export default function DoctorEntry() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Doctor Access</h2>
        <p className="text-sm text-gray-600 mb-6">Choose whether you already have an account or want to register as a doctor.</p>

        <div className="space-y-3">
          <button
            onClick={() => loginWithRedirect({ screen_hint: "login" })}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            I already have an account — Login
          </button>

          <button
            onClick={() => navigate("/register")}
            className="w-full py-3 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
          >
            Register as doctor (verify phone first)
          </button>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-6 w-full py-2 text-sm text-gray-600"
        >
          Back
        </button>
      </div>
    </div>
  );
}
