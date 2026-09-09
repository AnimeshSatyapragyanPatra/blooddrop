import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(url && serviceKey);
const explicitMock = process.env.MOCK_DB === "1";

// Vercel and most hosts set one of these; NODE_ENV covers everything else.
const IS_DEPLOYED = Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");

// Falling back to the in-memory database is a convenience for local dev. In a
// deployed environment it is a trap: the app would look healthy while every
// donor who registers is wiped on the next cold start. So a deployment with
// missing or misspelled credentials fails loudly instead of degrading quietly.
if (IS_DEPLOYED && !hasCredentials && !explicitMock) {
  const missing = [!url && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"]
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `[blooddrop] Refusing to start: ${missing} is not set. ` +
      "A deployed BloodDrop must talk to a real Supabase project — the in-memory " +
      "database loses all data on every cold start. Set the variable in your host's " +
      "environment settings, or set MOCK_DB=1 if you deliberately want a throwaway demo."
  );
}

export const MOCK = explicitMock || !hasCredentials;

let client;

if (MOCK) {
  const { mockSupabase } = await import("./mockDb.js");
  client = mockSupabase;
  console.log(
    IS_DEPLOYED
      ? "[blooddrop] WARNING: running the in-memory database in a deployed environment (MOCK_DB=1). Data resets on every cold start."
      : "[blooddrop] Running with the in-memory mock database (no Supabase)."
  );
} else {
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Host only — never log any part of a key.
  console.log(`[blooddrop] Connected to Supabase project ${new URL(url).host}`);
  if (!anonKey) {
    console.warn("[blooddrop] SUPABASE_ANON_KEY is not set. The API works without it, but keep it with the others for consistency.");
  }
}

export const supabase = client;
