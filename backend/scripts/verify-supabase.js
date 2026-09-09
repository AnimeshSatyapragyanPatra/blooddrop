// Checks a real Supabase project is wired up correctly, before you trust it.
//   npm run verify:supabase --prefix backend
//
// Every failure prints the exact fix. This never writes anything except one
// temporary donor row, which it deletes again.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "profiles", "donors", "requests", "alerts",
  "responses", "reports", "verifications", "notifications",
];

let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m, fix) => {
  failed += 1;
  console.log(`  ✗ ${m}`);
  if (fix) console.log(`      fix: ${fix}`);
};

console.log("\nCredentials");
if (!url) bad("SUPABASE_URL is not set", "add it to backend/.env (Supabase → Project Settings → Data API)");
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  bad(`SUPABASE_URL looks wrong: ${url}`, "it should look like https://abcdefgh.supabase.co with no trailing path");
} else ok(`SUPABASE_URL → ${new URL(url).host}`);

if (!serviceKey) bad("SUPABASE_SERVICE_ROLE_KEY is not set", "Project Settings → API keys → service_role. Keep it server-side only.");
else if (serviceKey === anonKey) {
  bad("SERVICE_ROLE_KEY and ANON_KEY are identical", "you pasted the same key twice — the service_role key is the secret one");
} else ok("SUPABASE_SERVICE_ROLE_KEY is set");

if (!anonKey) bad("SUPABASE_ANON_KEY is not set", "Project Settings → API keys → anon public");
else ok("SUPABASE_ANON_KEY is set");

if (process.env.MOCK_DB === "1") {
  bad("MOCK_DB=1 is still set", "remove that line from backend/.env, or the app ignores Supabase entirely");
}

if (failed) {
  console.log(`\n${failed} problem(s) — fix the above before continuing.\n`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("\nSchema");
for (const table of TABLES) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    bad(`table "${table}" is not reachable — ${error.message}`,
        "run supabase/migrations/001_schema.sql in the Supabase SQL editor");
  } else ok(`table "${table}"`);
}

console.log("\nPostGIS matching");
const { data: rpcData, error: rpcError } = await supabase.rpc("match_donors", {
  p_lat: 23.5204, p_lng: 87.3119, p_radius_km: 25, p_groups: ["O-", "O+"],
});

if (rpcError) {
  const missing = /function .* does not exist/i.test(rpcError.message);
  const postgis = /st_dwithin|geography|postgis/i.test(rpcError.message);
  bad(`match_donors RPC failed — ${rpcError.message}`,
      postgis ? "PostGIS is not enabled: run  create extension if not exists postgis;"
      : missing ? "run supabase/migrations/001_schema.sql — it creates the function"
      : "check the SQL editor for the full error");
} else {
  ok(`match_donors returned ${rpcData.length} row(s)`);
  const shape = ["user_id", "blood_group", "distance_km", "last_donation_date"];
  if (rpcData.length) {
    const missingCols = shape.filter((c) => !(c in rpcData[0]));
    if (missingCols.length) {
      bad(`RPC is missing columns: ${missingCols.join(", ")}`, "re-run 001_schema.sql; the function signature changed");
    } else ok("RPC returns the expected columns");
  } else {
    console.log("      (no donors yet — that is expected on a fresh project)");
  }
}

console.log("\nGenerated geography column");
// The geog column is generated from lat/lng. If PostGIS or the generated column
// is missing, this insert is where it shows up.
const probeId = randomUUID();
const { error: insertError } = await supabase.from("donors").insert({
  user_id: probeId, blood_group: "O-", lat: 23.5204, lng: 87.3119, contact_pref: "inapp",
});

if (insertError && /foreign key|violates/i.test(insertError.message)) {
  ok("donors.user_id is correctly bound to auth.users (probe row rejected, as it should be)");
} else if (insertError) {
  bad(`could not write a probe donor — ${insertError.message}`, "check the donors table definition in 001_schema.sql");
} else {
  ok("donors accepts a row and generates its geography point");
  await supabase.from("donors").delete().eq("user_id", probeId);
  ok("probe row cleaned up");
}

console.log("\nAuth");
const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
if (authError) bad(`admin auth call failed — ${authError.message}`, "confirm the service_role key is correct");
else ok("service_role key can reach Auth admin");

console.log("\nModerator account");
const { data: admins } = await supabase.from("profiles").select("email").eq("role", "admin");
if (!admins || admins.length === 0) {
  console.log("  ! no admin yet — the moderation and verification queues will be unreachable");
  console.log("      fix: edit the email in supabase/migrations/002_promote_admin.sql and run it");
} else ok(`admin: ${admins.map((a) => a.email).join(", ")}`);

console.log(failed ? `\n${failed} problem(s) found.\n` : "\nSupabase is wired up correctly.\n");
process.exit(failed ? 1 : 0);
