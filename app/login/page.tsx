"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureSeedData, getSessionUser, login } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    ensureSeedData();
    const existing = getSessionUser();
    if (existing) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const user = login(username, password);

    if (!user) {
      setError("Invalid credentials. Try agent1/agent123 or boy1/boy123.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-transparent p-6">
      <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-slate-900">SmartLedger Lite</h1>
        <p className="mt-2 text-sm text-slate-600">Simple demo login for college project</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring"
              placeholder="agent1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring"
              placeholder="agent123"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Login
          </button>
        </form>

        <div className="mt-6 rounded bg-slate-50 p-3 text-xs text-slate-600">
          <p>Agent: agent1 / agent123</p>
          <p>Delivery Boy: boy1 / boy123</p>
        </div>
      </div>
    </main>
  );
}
