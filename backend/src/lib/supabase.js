import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Offline mode: no Supabase project needed. On explicitly with MOCK_DB=1, and
// automatically whenever credentials are absent.
export const MOCK = process.env.MOCK_DB === "1" || !url || !serviceKey;

let client;

if (MOCK) {
  const { mockSupabase } = await import("./mockDb.js");
  client = mockSupabase;
  console.log("[blooddrop] Running with the in-memory mock database (no Supabase).");
} else {
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = client;
