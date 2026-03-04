import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api.js";

export default function RegisterWithPhone() {
  const [countryCode, setCountryCode] = useState("+1-US");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState(null);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const navigate = useNavigate();

  const countryOptions = [
    { code: "+1-US", label: "🇺🇸 United States (+1)" },
    { code: "+1-CA", label: "🇨🇦 Canada (+1)" },
    { code: "+86", label: "🇨🇳 China (+86)" },
    { code: "+44", label: "🇬🇧 UK (+44)" },
  ];

  function buildFullPhone() {
    const m = countryCode.match(/^([+\d]+)/);
    const base = m ? m[1] : "+1";
    return base + phone.replace(/\D/g, "");
  }

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  async function sendCode() {
    setMessage("");
    setMessageType("info");
    if (cooldownSeconds > 0) return;
    if (!/\d{7,15}/.test(phone)) {
      setMessageType("error");
      return setMessage("Please enter a valid phone number (digits only, 7-15 length).");
    }
    setLoading(true);
    try {
      const full = buildFullPhone();
      const res = await fetch(apiUrl("/public/send-sms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: full }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || payload.message || "发送验证码失败");
      setCooldownSeconds(5);
      setMessageType("success");
      setMessage("Verification code sent. It remains valid for 5 minutes unless you request a new code.");
    } catch (e) {
      setMessageType("error");
      setMessage(e.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setMessage("");
    setMessageType("info");
    if (!code.trim()) {
      setMessageType("error");
      return setMessage("Please enter the verification code.");
    }
    setLoading(true);
    try {
      const full = buildFullPhone();
      const res = await fetch(apiUrl("/public/verify-sms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: full, code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || payload.message || "校验失败");
      setVerificationToken(payload.verificationToken);
      setVerifiedPhoneNumber(full);
      setMessageType("success");
      setMessage("Phone verification succeeded. Complete the form below to finish registration.");
    } catch (e) {
      setMessageType("error");
      setMessage(e.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegistration(e) {
    e.preventDefault();
    setMessage("");
    setMessageType("info");
    if (!verificationToken || !verifiedPhoneNumber) {
      setMessageType("error");
      return setMessage("Please verify your phone number before registering.");
    }
    if (!name || !email) {
      setMessageType("error");
      return setMessage("Please fill in full name and email.");
    }
    setLoading(true);
    try {
      const body = { email, name, phoneNumber: verifiedPhoneNumber, verificationToken };
      if (password) body.password = password;
      const res = await fetch(apiUrl("/internal/create-auth0-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || payload.error || "注册失败");
      setMessageType("success");
      setMessage("Registration successful. Please continue to login.");
      // redirect to login/root after short delay
      setTimeout(() => navigate("/"), 1200);
    } catch (e) {
      setMessageType("error");
      setMessage(e.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-lg">
        <div className="mb-5">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-3">
            HCONNECT • Provider Onboarding
          </span>
          <h2 className="text-2xl font-semibold">Register (Phone Verification Required)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Complete identity verification before creating your clinical access account.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="block text-sm text-gray-700">Country / Dial Code</label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            disabled={!!verificationToken}
            className="mt-1 mb-1 border rounded px-3 py-2 w-full disabled:bg-gray-100"
          >
            {countryOptions.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>

          <label className="block text-sm text-gray-700">Phone Number (digits only)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            disabled={!!verificationToken}
            className="mt-1 mb-1 border rounded px-3 py-2 w-full disabled:bg-gray-100"
          />

          <div className="flex gap-2">
            <button
              onClick={sendCode}
              disabled={loading || cooldownSeconds > 0 || !!verificationToken}
              className="flex-1 bg-blue-600 text-white py-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {verificationToken ? "Code Verified" : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Send Code"}
            </button>
            <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 px-3 py-2 border rounded" />
            <button onClick={verifyCode} disabled={loading || !!verificationToken} className="bg-green-600 text-white px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed">Verify</button>
          </div>

          <p className="text-xs text-gray-500">
            Code validity: 5 minutes. Requesting a new code invalidates the previous one.
          </p>

          <hr className="my-2" />

          <label className="block text-sm text-gray-700">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 mb-1 border rounded px-3 py-2 w-full" />

          <label className="block text-sm text-gray-700">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 mb-1 border rounded px-3 py-2 w-full" />

          <label className="block text-sm text-gray-700">Password</label>
          <div className="flex gap-2 items-center">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 mb-1 border rounded px-3 py-2 w-full"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="px-3 py-2 mt-1 mb-1 border rounded text-sm"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button onClick={submitRegistration} disabled={loading || !verificationToken} className="w-full bg-indigo-600 text-white py-2 rounded disabled:bg-gray-400 disabled:cursor-not-allowed">Create HCONNECT Account</button>

          {message && (
            <div className={`mt-2 text-sm ${messageType === "error" ? "text-red-600" : messageType === "success" ? "text-green-600" : "text-gray-700"}`}>
              {message}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <button onClick={() => navigate(-1)} className="underline">Back</button>
        </div>
      </div>
    </div>
  );
}
