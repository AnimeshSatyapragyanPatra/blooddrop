import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { usePoll } from "../lib/usePoll.js";
import {
  IconBell, IconPin, IconPlus, IconList, IconUser, IconSearch,
  IconBadge, IconChart, IconFlag, IconShield, IconInbox,
} from "./icons.jsx";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const NAV = {
  donor: [
    { to: "/home", label: "Alerts for me", end: true, icon: IconBell },
    { to: "/nearby", label: "Nearby requests", icon: IconPin },
    { to: "/requests/new", label: "Post a request", icon: IconPlus },
    { to: "/requests", label: "My requests", end: true, icon: IconList },
    { to: "/profile", label: "My donor profile", icon: IconUser },
  ],
  requester: [
    { to: "/requests", label: "My requests", end: true, icon: IconList },
    { to: "/requests/new", label: "Post a request", icon: IconPlus },
    { to: "/donors", label: "Find donors", icon: IconSearch },
    { to: "/profile", label: "Donor profile", icon: IconUser },
    { to: "/verification", label: "Get verified", icon: IconBadge },
  ],
  facility: [
    { to: "/facility", label: "Donation desk", end: true, icon: IconList },
    { to: "/donors", label: "Find donors", icon: IconSearch },
  ],
  admin: [
    { to: "/admin", label: "Overview", end: true, icon: IconChart },
    { to: "/facility", label: "Donation desk", icon: IconList },
    { to: "/admin/reports", label: "Moderation queue", icon: IconFlag },
    { to: "/admin/verifications", label: "Verification queue", icon: IconShield },
    { to: "/admin/documents", label: "Blood group proofs", icon: IconBadge },
    { to: "/donors", label: "Find donors", icon: IconSearch },
    { to: "/requests/new", label: "Post a request", icon: IconPlus },
  ],
};

export default function AppLayout() {
  const { user, donor, logout, token } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = NAV[user.role] || NAV.donor;

  // Polling keeps the badge live in both mock and Supabase mode; swapping in
  // Supabase Realtime later only changes this callback.
  const pollUnread = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/api/notifications", { token });
      setUnread(data.unread);
    } catch {
      /* a failed poll is not worth interrupting the user for */
    }
  }, [token]);

  useEffect(() => {
    pollUnread();
  }, [pollUnread]);

  usePoll(pollUnread, 30000);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-ink px-5 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <Logo className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight">BloodDrop</span>
              <span className="block text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">{user.role}</span>
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
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blood-500"
                    : "text-stone-400 dark:text-stone-500 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </NavLink>
          ))}

          <NavLink
            to="/notifications"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blood-500"
                  : "text-stone-400 dark:text-stone-500 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <IconInbox className="h-4 w-4 shrink-0" />
            <span className="flex-1">Inbox</span>
            {unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blood-600 px-1.5 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </NavLink>
        </nav>

        <div className={`mt-8 border-t border-white/10 pt-4 lg:mt-auto ${menuOpen ? "block" : "hidden"} lg:block`}>
          <p className="truncate text-sm font-medium">{user.organization || user.name}</p>
          <p className="truncate text-xs text-stone-400 dark:text-stone-500">{user.email}</p>
          {donor && (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              {donor.bloodGroup} · {donor.eligibility.eligible ? "eligible" : `${donor.eligibility.daysRemaining} d to go`}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button onClick={handleLogout} className="text-sm text-stone-300 hover:text-white">
              Sign out
            </button>
            <ThemeToggle className="-mr-2" />
          </div>
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
