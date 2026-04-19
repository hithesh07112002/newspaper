"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginApi, meApi, registerApi } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [registerRole, setRegisterRole] = useState<"USER" | "AGENT" | "DELIVERY_BOY">("USER");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        await meApi();
        if (mounted) {
          router.replace("/dashboard");
        }
      } catch {
        return;
      }
    };

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (registerMode) {
        const payload = await registerApi({
          email: identifier.trim().toLowerCase(),
          password: password.trim(),
          role: registerRole,
        });
        setMessage(payload.message);
        setRegisterMode(false);
        setPassword("");
      } else {
        await loginApi(identifier.trim(), password.trim());
        router.push("/dashboard");
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Request failed";
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent p-6">
      <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-slate-900">SmartLedger Pro</h1>
        <p className="mt-2 text-sm text-slate-600">
          {registerMode ? "Create account" : "Secure login with server-side sessions"}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {registerMode ? "Email" : "Email or Username"}
            </label>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring"
              placeholder={registerMode ? "you@example.com" : "you@example.com or your username"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring"
              placeholder={registerMode ? "At least 10 chars with letters and numbers" : "Enter password"}
            />
            {registerMode ? (
              <p className="mt-1 text-xs text-slate-500">
                Password must be at least 10 characters and include at least one letter and one number.
              </p>
            ) : null}
          </div>

          {registerMode ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Register as</label>
              <select
                value={registerRole}
                onChange={(event) => setRegisterRole(event.target.value as "USER" | "AGENT" | "DELIVERY_BOY")}
                className="w-full rounded border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring"
              >
                <option value="USER">User</option>
                <option value="AGENT">Agent</option>
                <option value="DELIVERY_BOY">Delivery Boy</option>
              </select>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (registerMode ? "Creating account..." : "Signing in...") : registerMode ? "Register" : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setRegisterMode((prev) => !prev);
            setError("");
            setMessage("");
          }}
          className="mt-3 w-full rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {registerMode ? "Back to Login" : "New user? Register here"}
        </button>

        <div className="mt-6 rounded bg-slate-50 p-3 text-xs text-slate-600">
          <p>Use your assigned email or username with your password.</p>
          <p>Delivery boy accounts must be approved by an agent before login.</p>
        </div>
      </div>
    </main>
  );
}
