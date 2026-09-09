import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Offline mode: no Supabase project needed. On with VITE_MOCK=1, and
// automatically whenever credentials are absent.
const MOCK = import.meta.env.VITE_MOCK === "1" || !url || !anonKey;

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:5060" : "");
const SESSION_KEY = "blooddrop_mock_session";

function createMockClient() {
  const listeners = new Set();

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
    listeners.forEach((cb) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session));
  }

  return {
    auth: {
      async getSession() {
        return { data: { session: readSession() }, error: null };
      },
      onAuthStateChange(cb) {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      async signInWithPassword({ email, password }) {
        const res = await fetch(`${API_URL}/api/auth/mock-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { data: { session: null }, error: new Error(body.error || "Invalid email or password") };
        }
        writeSession(body.session);
        return { data: { session: body.session }, error: null };
      },
      async signOut() {
        writeSession(null);
        return { error: null };
      },
    },
  };
}

export const supabase = MOCK ? createMockClient() : createClient(url, anonKey);
export const IS_MOCK = MOCK;
