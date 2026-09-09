import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { supabase } from "../services/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [donor, setDonor] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = useCallback((data) => {
    setUser(data?.user || null);
    setDonor(data?.donor || null);
    setVerification(data?.verification || null);
  }, []);

  const loadProfile = useCallback(
    async (currentSession) => {
      if (!currentSession?.access_token) {
        applyProfile(null);
        return null;
      }
      const data = await api("/api/me", { token: currentSession.access_token });
      applyProfile(data);
      return data;
    },
    [applyProfile]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        await loadProfile(data.session);
      } catch {
        applyProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession).catch(() => applyProfile(null));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, applyProfile]);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
    const profile = await loadProfile(data.session);
    return profile.user;
  }

  const value = useMemo(
    () => ({
      session,
      user,
      donor,
      verification,
      loading,
      token: session?.access_token || null,
      isDonor: Boolean(donor),
      login: signIn,
      async register(payload) {
        await api("/api/auth/register", { method: "POST", body: payload });
        return signIn(payload.email, payload.password);
      },
      async refresh() {
        return loadProfile(session);
      },
      async logout() {
        await supabase.auth.signOut();
        applyProfile(null);
        setSession(null);
      },
      homePath() {
        if (user?.role === "admin") return "/admin";
        if (user?.role === "requester") return "/requests";
        return "/home";
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, user, donor, verification, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
