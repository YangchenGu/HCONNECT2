import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">hconnect</h1>
          <p className="text-gray-600 text-lg">Healthcare Management Platform</p>
        </div>

        {/* Description */}
        <div className="text-center mb-8">
          <p className="text-gray-700 mb-4">
            Manage patients, view reports, and track health data all in one place.
          </p>
          <p className="text-sm text-gray-500">
            Sign in with your Auth0 account to get started.
          </p>
        </div>

        {/* Login Button */}
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

        {/* Footer */}
        <div className="text-center mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Protected by Auth0 • Secure & HIPAA-compliant
          </p>
        </div>
      </div>
    </div>
  );
}
