import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { IS_MOCK } from "../services/supabase.js";
import { ErrorBanner } from "../components/ui.jsx";
import Logo from "../components/Logo.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const homeFor = (role) =>
  role === "admin" ? "/admin" : role === "facility" ? "/facility" : role === "requester" ? "/requests" : "/home";

const DEMO = [
  ["Donor", "donor@blooddrop.test", "Donor123!"],
  ["Verified hospital", "hospital@blooddrop.test", "Hospital123!"],
  ["Individual requester", "requester@blooddrop.test", "Requester123!"],
  ["Blood bank staff", "bloodbank@blooddrop.test", "Bank123!"],
  ["Moderator", "admin@blooddrop.test", "Admin123!"],
];

export default function Login() {
  const { user, login, homePath } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homePath()} replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await login(email.trim(), password);
      navigate(homeFor(profile.role));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function useDemo(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setBusy(true);
    setError(null);
    try {
      const profile = await login(demoEmail, demoPassword);
      navigate(homeFor(profile.role));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-white lg:flex">
        {/* Two soft light sources keep the dark panel from reading as a slab. */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blood-600/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-blood-800/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Logo className="h-7 w-7" withRing />
          </span>
          <span className="text-lg font-semibold tracking-tight">BloodDrop</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            The WhatsApp forward, replaced by something that answers back.
          </h2>
          <p className="mt-4 text-stone-300">
            Emergency blood requests reach eligible donors nearby in seconds — and the requester sees who is coming,
            instead of silence.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-300">
            <li className="flex gap-2"><span className="text-blood-400">✓</span> Matched on blood compatibility, distance and the 90-day donation gap</li>
            <li className="flex gap-2"><span className="text-blood-400">✓</span> Phone numbers stay masked until a donor accepts</li>
            <li className="flex gap-2"><span className="text-blood-400">✓</span> Hospitals and blood banks carry a moderator-checked badge</li>
          </ul>
        </div>
        <p className="relative text-xs text-stone-500 dark:text-stone-400">Built with React, Express and Supabase + PostGIS.</p>
      </div>

      <div className="relative grid place-items-center px-4 py-10">
        {/* Signed-out visitors need the theme switch too — the sidebar one is
            only reachable once you are in. */}
        <div className="absolute right-4 top-4">
          <ThemeToggle className="text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100" />
        </div>

        <div className="w-full max-w-md">
          {/* The marketing panel is desktop-only, so phones get the mark here. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blood-50 dark:bg-blood-500/10 ring-1 ring-blood-100 dark:ring-blood-500/20">
              <Logo className="h-7 w-7" withRing />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50">BloodDrop</span>
              <span className="block text-xs text-stone-500 dark:text-stone-400">Emergency donor alerts</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">Sign in</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            New here?{" "}
            <Link to="/register" className="font-semibold text-blood-700 dark:text-blood-300 hover:underline">
              Create an account
            </Link>
          </p>

          <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {IS_MOCK && (
            <div className="card mt-4 p-5">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Demo accounts</p>
              <p className="hint">Running on the built-in mock database — no Supabase project needed.</p>
              <div className="mt-3 grid gap-2">
                {DEMO.map(([label, demoEmail, demoPassword]) => (
                  <button
                    key={demoEmail}
                    type="button"
                    onClick={() => useDemo(demoEmail, demoPassword)}
                    disabled={busy}
                    className="btn-secondary justify-between text-left"
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">{demoEmail}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
