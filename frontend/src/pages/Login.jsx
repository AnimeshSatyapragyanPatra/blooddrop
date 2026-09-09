import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { IS_MOCK } from "../services/supabase.js";
import { ErrorBanner } from "../components/ui.jsx";

const DEMO = [
  ["Donor", "donor@blooddrop.test", "Donor123!"],
  ["Verified hospital", "hospital@blooddrop.test", "Hospital123!"],
  ["Individual requester", "requester@blooddrop.test", "Requester123!"],
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
      navigate(profile.role === "admin" ? "/admin" : profile.role === "requester" ? "/requests" : "/home");
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
      navigate(profile.role === "admin" ? "/admin" : profile.role === "requester" ? "/requests" : "/home");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blood-500 to-blood-700 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M12 2.7s6 6.6 6 10.5a6 6 0 0 1-12 0C6 9.3 12 2.7 12 2.7Z" />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight">BloodDrop</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight">
            The WhatsApp forward, replaced by something that answers back.
          </h2>
          <p className="mt-4 text-stone-300">
            Emergency blood requests reach eligible donors nearby in seconds — and the requester sees who is coming,
            instead of silence.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-stone-300">
            <li>· Matched on blood compatibility, distance and the 90-day donation gap</li>
            <li>· Phone numbers stay masked until a donor accepts</li>
            <li>· Hospitals and blood banks carry a moderator-checked badge</li>
          </ul>
        </div>
        <p className="text-xs text-stone-500">Built with React, Express and Supabase + PostGIS.</p>
      </div>

      <div className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* The marketing panel is desktop-only, so phones get the mark here. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blood-500 to-blood-700 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                <path d="M12 2.7s6 6.6 6 10.5a6 6 0 0 1-12 0C6 9.3 12 2.7 12 2.7Z" />
              </svg>
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-stone-900">BloodDrop</span>
              <span className="block text-xs text-stone-500">Emergency donor alerts</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Sign in</h1>
          <p className="mt-1 text-sm text-stone-500">
            New here?{" "}
            <Link to="/register" className="font-semibold text-blood-700 hover:underline">
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
              <p className="text-sm font-semibold text-stone-800">Demo accounts</p>
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
                    <span className="text-xs text-stone-500">{demoEmail}</span>
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
