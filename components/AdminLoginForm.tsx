"use client";
import { Skeleton } from "@/components/Skeleton";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { ToastNotice } from "@/components/ToastNotice";
import { loginAdmin, listCampaigns } from "@/lib/api";
import type { AdminSession } from "@/lib/adminSession";

type Props = {
  onAuthenticated: (session: AdminSession) => void;
};

export function AdminLoginForm({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 7000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const session = await loginAdmin(email.trim(), password, "job_seeker");
      await listCampaigns({ token: session.token, status: "all" });
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-layout">
      {error && <ToastNotice tone="error" text={error} onClose={() => setError("")} />}

      <div className="flex min-h-dvh items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="brand-lockup mb-10"><span className="brand-mark">M</span><span>Mastaskillz<small>ADMIN WORKSPACE</small></span></div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use the same login details as the main MastaSkillz site.</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div>
              <label htmlFor="admin-email" className="text-xs font-semibold text-slate-700">Email</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-700"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="text-xs font-semibold text-slate-700">Password</label>
              <div className="mt-2 flex h-12 items-center rounded-xl border border-slate-200 px-4 focus-within:border-emerald-700">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Skeleton label="Signing in" className="h-4 w-16" /> : "Login"}
            </button>
          </form>

          <p className="mt-7 flex items-center gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0" />
            Dashboard access is restricted to accounts marked as administrators.
          </p>
        </div>
      </div>
    </section>
  );
}
