// Populates a real Supabase project with the same demo dataset the local mock
// uses, so a hosted demo is not an empty screen.
//   npm run seed:supabase --prefix backend
//   npm run seed:supabase --prefix backend -- --force   (re-seed a used project)
//
// Creates the four demo accounts, 15 donors, two live requests and a dispatch
// trail, then promotes the admin. Safe to skip entirely for a real deployment.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { haversineKm } from "../src/lib/geo.js";
import { compatibleDonorGroups } from "../src/lib/blood.js";
import {
  CENTRE, daysAgo, hoursFromNow, offset, SEED_ACCOUNTS, SEED_DONORS, AREAS, DEMO_PASSWORD,
} from "../src/lib/demoData.js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const force = process.argv.includes("--force");

if (!url || !serviceKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const die = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

// ---- Guard: never trample a project that is already in use -----------------

const { count: existing, error: countError } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true });

if (countError) {
  die(`Cannot read the profiles table — ${countError.message}\nRun supabase/migrations/001_schema.sql first.`);
}
if (existing > 0 && !force) {
  die(`This project already has ${existing} profile(s). Refusing to seed on top of real data.\nRe-run with --force if you are sure this is a throwaway demo project.`);
}

console.log(`Seeding ${new URL(url).host}…`);

async function createUser(email, password, name, phone) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name, phone },
  });
  if (error) {
    if (/already/i.test(error.message)) {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list?.users?.find((u) => u.email === email.toLowerCase());
      if (found) return found.id;
    }
    die(`Could not create ${email} — ${error.message}`);
  }
  return data.user.id;
}

const must = async (label, promise) => {
  const { error } = await promise;
  if (error) die(`${label} failed — ${error.message}`);
};

// ---- Accounts --------------------------------------------------------------

const ids = {};
for (const acc of SEED_ACCOUNTS) {
  const userId = await createUser(acc.email, acc.password, acc.name, acc.phone);
  ids[acc.role === "requester" && acc.verified ? "hospital" : acc.role] = userId;

  await must(`profile ${acc.email}`, supabase.from("profiles").upsert({
    user_id: userId,
    name: acc.name,
    email: acc.email,
    phone: acc.phone,
    role: acc.role,
    organization: acc.organization || null,
    org_type: acc.orgType || null,
    verified: Boolean(acc.verified),
  }, { onConflict: "user_id" }));

  if (acc.donor) {
    const p = offset(acc.donor.km, acc.donor.bearing);
    const [a, r, d, n] = acc.donor.stats;
    await must(`donor ${acc.email}`, supabase.from("donors").upsert({
      user_id: userId,
      blood_group: acc.donor.group,
      lat: p.lat, lng: p.lng,
      area_label: "Bidhannagar, Durgapur",
      last_donation_date: acc.donor.last ? daysAgo(acc.donor.last) : null,
      contact_pref: acc.donor.pref,
      paused: false,
      alerts_received: a, responses_given: r, donations_confirmed: d, no_shows: n,
    }, { onConflict: "user_id" }));
  }
  console.log(`  · ${acc.email} (${acc.role})`);
}

// ---- Donor pool ------------------------------------------------------------

const donorRows = [];
for (const [i, [name, group, km, bearing, last, pref, stats, paused]] of SEED_DONORS.entries()) {
  const email = `${name.toLowerCase().split(" ")[0]}${i}@donor.test`;
  const phone = `+91 9${String(800000000 + i * 111111).slice(0, 9)}`;
  const userId = await createUser(email, DEMO_PASSWORD, name, phone);
  const p = offset(km, bearing);
  const [a, r, d, n] = stats;

  await must(`profile ${email}`, supabase.from("profiles").upsert({
    user_id: userId, name, email, phone, role: "donor", verified: false,
  }, { onConflict: "user_id" }));

  const donor = {
    user_id: userId,
    blood_group: group,
    lat: p.lat, lng: p.lng,
    area_label: `${AREAS[i % AREAS.length]}, Durgapur`,
    last_donation_date: last ? daysAgo(last) : null,
    contact_pref: pref,
    paused,
    alerts_received: a, responses_given: r, donations_confirmed: d, no_shows: n,
  };
  await must(`donor ${email}`, supabase.from("donors").upsert(donor, { onConflict: "user_id" }));
  donorRows.push({ ...donor, name });
}
console.log(`  · ${SEED_DONORS.length} donors`);

// ---- Requests --------------------------------------------------------------

const hospitalPoint = offset(0.5, 0);
const { data: critical } = await supabase.from("requests").insert({
  requester_id: ids.hospital,
  patient_name: "Post-op patient (Ward 4)",
  blood_group: "O-", units_needed: 2,
  hospital_name: "Durgapur Mission Hospital",
  lat: hospitalPoint.lat, lng: hospitalPoint.lng,
  area_label: "Durgapur Mission Hospital, Benachity",
  urgency: "critical",
  needed_by: hoursFromNow(8),
  notes: "Surgery scheduled tomorrow morning. Blood bank stock is out.",
  radius_km: 20, status: "open", verified: true,
}).select("*").single();

const routinePoint = offset(3.0, 180);
const { data: routine } = await supabase.from("requests").insert({
  requester_id: ids.requester,
  patient_name: "My father",
  blood_group: "B+", units_needed: 1,
  hospital_name: "Sadar Hospital, Durgapur",
  lat: routinePoint.lat, lng: routinePoint.lng,
  area_label: "Sadar Hospital, Durgapur",
  urgency: "urgent",
  needed_by: hoursFromNow(36),
  notes: "Dialysis patient, transfusion needed within two days.",
  radius_km: 15, status: "open", verified: false,
}).select("*").single();

console.log("  · 2 open requests");

// ---- Dispatch trail --------------------------------------------------------
// Same compatibility rule the live matcher uses, so the seed can never show a
// state the app would not produce itself.

const byName = (name) => donorRows.find((d) => d.name === name);
const demoDonor = SEED_ACCOUNTS.find((a) => a.donor);
const { data: demoDonorRow } = await supabase
  .from("donors").select("*").eq("user_id", ids.donor).maybeSingle();

async function seedAlert(request, point, donor, minutesAgo, response) {
  if (!donor) return;
  if (!compatibleDonorGroups(request.blood_group).includes(donor.blood_group)) {
    die(`Refusing to seed an incompatible alert: ${donor.blood_group} donor on a ${request.blood_group} request`);
  }
  await must("alert", supabase.from("alerts").insert({
    request_id: request.id,
    donor_user_id: donor.user_id,
    channel: donor.contact_pref,
    status: "sent",
    distance_km: Math.round(haversineKm(point.lat, point.lng, donor.lat, donor.lng) * 10) / 10,
    sent_at: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  }));
  if (response) {
    await must("response", supabase.from("responses").insert({
      request_id: request.id,
      donor_user_id: donor.user_id,
      status: response.status,
      note: response.note,
      responded_at: new Date(Date.now() - (minutesAgo - 20) * 60000).toISOString(),
    }));
  }
}

await seedAlert(critical, hospitalPoint, byName("Imran Khan"), 100, {
  status: "available", note: "Can reach the hospital within the hour.",
});
await seedAlert(critical, hospitalPoint, byName("Kabir Das"), 100, {
  status: "unavailable", note: "Out of town until Friday.",
});
await seedAlert(critical, hospitalPoint, byName("Ritu Banerjee"), 100, null);
await seedAlert(routine, routinePoint, demoDonorRow, 45, null);
await seedAlert(routine, routinePoint, byName("Priya Sharma"), 45, null);

await must("report", supabase.from("reports").insert({
  target_type: "request", target_id: routine.id, reporter_id: ids.donor,
  reason: "suspicious", details: "Same request text was posted twice from different numbers.",
  status: "open",
}));

await must("notification", supabase.from("notifications").insert({
  user_id: ids.donor, type: "alert",
  title: "Urgent: B+ needed nearby",
  body: `${routine.hospital_name} needs 1 unit of B+ — your O+ blood is compatible.`,
  request_id: routine.id, read: false,
}));

console.log("  · dispatch trail, one open report, one inbox alert");
console.log(`\nSeeded. Sign in as ${SEED_ACCOUNTS[0].email} / ${SEED_ACCOUNTS[0].password}\n`);
console.log("These are demo accounts with published passwords — delete them before any real use.\n");
