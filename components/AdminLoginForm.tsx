"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
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
    <section className="grid min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
      <div className="hidden flex-col justify-center bg-emerald-950 p-12 text-white lg:flex">
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-xl bg-white/10">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
        </div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Access the dashboard.<br />Review growth.<br />Track every credit.
        </h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-emerald-100/75">
          Sign in with your MastaSkillz account to access the administration workspace.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {["Campaign funding", "Bonus reporting", "Member controls"].map((label) => (
            <span key={label} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 lg:hidden">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">MastaSkillz Admin</p>
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
                className="mt-2 h-11 w-full border-0 border-b border-slate-300 bg-transparent px-0 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-700"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="text-xs font-semibold text-slate-700">Password</label>
              <div className="mt-2 flex h-11 items-center border-b border-slate-300 focus-within:border-emerald-700">
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

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Dashboard access is restricted to accounts marked as administrators.
          </p>
        </div>
      </div>
    </section>
  );
}
