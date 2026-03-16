import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api.js";

export default function PatientRegister() {
  const navigate = useNavigate();
  const { loginWithRedirect } = useAuth0();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    countryCode: "+1-US",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const countryOptions = [
    { code: "+1-US", label: "United States (+1)" },
    { code: "+1-CA", label: "Canada (+1)" },
    { code: "+44-GB", label: "United Kingdom (+44)" },
    { code: "+86-CN", label: "China (+86)" },
  ];

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in name, email and password.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.phone && !/^\d{7,15}$/.test(form.phone)) {
      setError("Phone must be 7-15 digits when provided.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/public/register-patient"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          countryCode: form.countryCode,
          phone: form.phone,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(payload.details)
          ? payload.details.map((d) => d?.message || d?.error).filter(Boolean).join("; ")
          : "";
        const reason = payload.message || payload.error || payload.description || payload.error_description || "Registration failed";
        throw new Error(details ? `${reason} (${details})` : reason);
      }

      setMessage("Patient account created successfully. Please sign in.");
      setTimeout(() => {
        loginWithRedirect({ screen_hint: "login" });
      }, 800);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,#1e3a6b_0%,#13284b_35%,#0b162d_100%)] text-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-blue-300/30 bg-[#102445]/92 backdrop-blur p-8 shadow-2xl shadow-black/50">
        <div className="inline-flex rounded-full border border-blue-300/35 bg-blue-900/50 px-3 py-1 text-xs tracking-wide text-blue-100">
          PATIENT REGISTRATION
        </div>

        <h1 className="mt-4 text-3xl font-semibold text-white">Create your patient account</h1>
        <p className="mt-2 text-sm text-blue-100/85">Country selection is required for regional data boundary rules. Phone is optional.</p>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-3">
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Full name"
            className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 placeholder-blue-200/60 outline-none focus:border-blue-300/70"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 placeholder-blue-200/60 outline-none focus:border-blue-300/70"
          />

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2">
            <select
              value={form.countryCode}
              onChange={(e) => update("countryCode", e.target.value)}
              className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 outline-none focus:border-blue-300/70"
            >
              {countryOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
              placeholder="Phone digits (optional)"
              className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 placeholder-blue-200/60 outline-none focus:border-blue-300/70"
            />
          </div>

          <input
            type="password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Password (min 8 chars)"
            className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 placeholder-blue-200/60 outline-none focus:border-blue-300/70"
          />
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => update("confirm", e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-xl border border-blue-300/35 bg-blue-900/45 px-3 py-2.5 text-blue-100 placeholder-blue-200/60 outline-none focus:border-blue-300/70"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-blue-500/90 hover:bg-blue-400 text-white font-semibold py-3 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create patient account"}
          </button>
        </form>

        {error ? <div className="mt-3 rounded-lg bg-rose-500/15 border border-rose-400/30 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        {message ? <div className="mt-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}

        <button
          onClick={() => navigate("/patient/entry")}
          className="mt-5 text-sm text-blue-200/90 hover:text-blue-100 underline underline-offset-4"
        >
          Back to patient entry
        </button>
      </div>
    </div>
  );
}
