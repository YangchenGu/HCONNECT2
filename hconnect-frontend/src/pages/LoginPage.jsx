import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
        <div className="text-center mb-7">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-4">
            HCONNECT • Medical Monitoring System
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">hconnect</h1>
          <p className="text-gray-600 text-lg">Unified Clinical Monitoring Workspace</p>
        </div>

        <div className="grid gap-2 mb-7 text-sm text-gray-700">
          <div className="rounded-lg bg-slate-50 px-3 py-2">🩺 Live patient status and trend tracking</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">📊 Clinical reports and care insights</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">🔔 Alerts, notifications, and workflow updates</div>
        </div>

        <button
          onClick={() => loginWithRedirect()}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              Signing in...
            </>
          ) : (
            <>
              <span>🔐</span>
              Sign In with Auth0
            </>
          )}
        </button>

        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Protected access for care teams • Auth0 secured session
          </p>
        </div>
      </div>
    </div>
  );
}
