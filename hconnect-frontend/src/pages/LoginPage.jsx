import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#2f2758_0%,#1b1640_45%,#100c24_100%)] flex items-center justify-center p-4">
      <div className="rounded-2xl border border-violet-300/28 bg-[#171133]/92 shadow-2xl p-8 max-w-lg w-full text-slate-100">
        <div className="text-center mb-7">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-violet-300/18 text-violet-100 mb-4">
            HCONNECT • Medical Monitoring System
          </span>
          <h1 className="text-4xl font-bold text-slate-100 mb-2">hconnect</h1>
          <p className="text-slate-300 text-lg">Unified Clinical Monitoring Workspace</p>
        </div>

        <div className="grid gap-2 mb-7 text-sm text-slate-300">
          <div className="rounded-lg bg-slate-900/50 border border-slate-600/30 px-3 py-2">🩺 Live patient status and trend tracking</div>
          <div className="rounded-lg bg-slate-900/50 border border-slate-600/30 px-3 py-2">📊 Clinical reports and care insights</div>
          <div className="rounded-lg bg-slate-900/50 border border-slate-600/30 px-3 py-2">🔔 Alerts, notifications, and workflow updates</div>
        </div>

        <button
          onClick={() => loginWithRedirect()}
          disabled={isLoading}
          className="w-full bg-violet-500/90 hover:bg-violet-400 disabled:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
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

        <div className="text-center mt-8 pt-6 border-t border-slate-600/40">
          <p className="text-xs text-slate-400">
            Protected access for care teams • Auth0 secured session
          </p>
        </div>
      </div>
    </div>
  );
}
