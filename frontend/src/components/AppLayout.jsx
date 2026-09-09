import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";

const NAV = {
  donor: [
    { to: "/home", label: "Alerts for me", end: true },
    { to: "/nearby", label: "Nearby requests" },
    { to: "/requests/new", label: "Post a request" },
    { to: "/requests", label: "My requests", end: true },
    { to: "/profile", label: "My donor profile" },
  ],
  requester: [
    { to: "/requests", label: "My requests", end: true },
    { to: "/requests/new", label: "Post a request" },
    { to: "/donors", label: "Find donors" },
    { to: "/profile", label: "Donor profile" },
    { to: "/verification", label: "Get verified" },
  ],
  admin: [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/reports", label: "Moderation queue" },
    { to: "/admin/verifications", label: "Verification queue" },
    { to: "/donors", label: "Find donors" },
    { to: "/requests/new", label: "Post a request" },
  ],
};

export default function AppLayout() {
  const { user, donor, logout, token } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = NAV[user.role] || NAV.donor;

  // Polling keeps the badge live in both mock and Supabase mode; swapping in
  // Supabase Realtime later only changes this effect.
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const data = await api("/api/notifications", { token });
        if (active) setUnread(data.unread);
      } catch {
        /* a failed poll is not worth interrupting the user for */
      }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-ink px-5 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blood-600 text-lg font-bold">◆</span>
            <span>
              <span className="block font-semibold tracking-tight">BloodDrop</span>
              <span className="block text-xs uppercase tracking-wider text-stone-400">{user.role}</span>
            </span>
          </Link>
          <button
            className="rounded-lg px-3 py-2 text-sm text-stone-300 hover:bg-white/10 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>

        <nav className={`mt-6 space-y-1 ${menuOpen ? "block" : "hidden"} lg:block`}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive ? "bg-white/10 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <NavLink
            to="/notifications"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium ${
                isActive ? "bg-white/10 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            Inbox
            {unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blood-600 px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </NavLink>
        </nav>

        <div className={`mt-8 border-t border-white/10 pt-4 lg:mt-auto ${menuOpen ? "block" : "hidden"} lg:block`}>
          <p className="truncate text-sm font-medium">{user.organization || user.name}</p>
          <p className="truncate text-xs text-stone-400">{user.email}</p>
          {donor && (
            <p className="mt-1 text-xs text-stone-400">
              {donor.bloodGroup} · {donor.eligibility.eligible ? "eligible" : `${donor.eligibility.daysRemaining} d to go`}
            </p>
          )}
          <button onClick={handleLogout} className="mt-3 text-sm text-stone-300 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
