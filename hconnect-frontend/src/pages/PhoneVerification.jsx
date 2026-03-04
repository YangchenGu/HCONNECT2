import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api.js";

export default function PhoneVerification({ onVerified }) {
  const [step, setStep] = useState(1);
  const [countryCode, setCountryCode] = useState("+1-CA");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const countryOptions = [
    { code: "+1-CA", label: "🇨🇦 Canada (+1)" },
    { code: "+1-US", label: "🇺🇸 United States (+1)" },
    { code: "+86", label: "🇨🇳 China (+86)" },
    { code: "+44", label: "🇬🇧 UK (+44)" },
    { code: "+81", label: "🇯🇵 Japan (+81)" },
    { code: "+33", label: "🇫🇷 France (+33)" },
    { code: "+49", label: "🇩🇪 Germany (+49)" },
    { code: "+39", label: "🇮🇹 Italy (+39)" },
    { code: "+61", label: "🇦🇺 Australia (+61)" },
  ];

  const fullPhone = `${countryCode.match(/^([+\d]+)/)[1]}${phone}`;

  const handleContinue = async () => {
    setError("");
    if (!countryCode || !phone.trim()) return setError("Please enter a valid phone number.");

    setLoading(true);
    try {
      // verify existence in provider DB
      const resp = await fetch(apiUrl("/api/doctor/verify-phone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_code: countryCode, phone }),
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.error || "Phone not recognized");
      }
      // send sms code
      const smsResp = await fetch(apiUrl("/public/send-sms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone }),
      });
      if (!smsResp.ok) {
        const payload = await smsResp.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to send SMS");
      }
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!code.trim()) return setError("Enter the verification code");
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/public/verify-sms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: fullPhone, code }),
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.error || "Code verification failed");
      }
      // success
      // also remember the country portion so we can autofill later
      const cMatch = countryCode.match(/^\+\d+-(\w{2})$/);
      const country = cMatch ? cMatch[1] : null;
      localStorage.setItem("preverified_phone", fullPhone);
      if (country) localStorage.setItem("preverified_country", country);
      localStorage.setItem("phone_verified", fullPhone);
      onVerified(fullPhone);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Phone verification</h1>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Country</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                >
                  {countryOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="4168215694"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Enter verification code</h1>
            <p className="text-center text-gray-600 mb-4">Code sent to {fullPhone}</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full px-3 py-2 border rounded-lg"
            />
            {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
