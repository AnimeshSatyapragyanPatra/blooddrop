import { supabase, MOCK } from "../lib/supabase.js";
import { isBloodGroup } from "../lib/blood.js";
import { isLatLng } from "../lib/geo.js";
import { donorView } from "../lib/views.js";

const ROLES = ["donor", "requester"];

// Local mock sign-in, only reachable when the server runs without Supabase.
// With a real project the browser signs in against Supabase Auth directly.
export async function mockLogin(req, res) {
  if (!MOCK) return res.status(404).json({ error: "Not found" });
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ session: data.session });
}

export async function register(req, res) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  const role = ROLES.includes(req.body.role) ? req.body.role : "donor";
  const organization = String(req.body.organization || "").trim() || null;

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: "Enter your name, email, and a password of at least 6 characters" });
  }
  if (!phone || phone.replace(/\D/g, "").length < 8) {
    return res.status(400).json({ error: "A reachable phone number is required — it stays masked until you accept a request" });
  }

  const donor = req.body.donor || null;
  if (role === "donor") {
    if (!donor || !isBloodGroup(donor.bloodGroup)) {
      return res.status(400).json({ error: "Choose your blood group" });
    }
    if (!isLatLng(Number(donor.lat), Number(donor.lng))) {
      return res.status(400).json({ error: "Set your location on the map so we can match you by distance" });
    }
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (error) {
    const already = /already|registered|exists/i.test(error.message || "");
    return res.status(400).json({
      error: already ? "An account with this email already exists. Please sign in." : error.message,
    });
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    { user_id: data.user.id, name, email, phone, role, organization, org_type: null, verified: false },
    { onConflict: "user_id" }
  );
  if (profileError) return res.status(500).json({ error: profileError.message });

  if (role === "donor") {
    const { error: donorError } = await supabase.from("donors").upsert(
      {
        user_id: data.user.id,
        blood_group: donor.bloodGroup,
        lat: Number(donor.lat),
        lng: Number(donor.lng),
        area_label: String(donor.areaLabel || "").trim() || null,
        last_donation_date: donor.lastDonationDate || null,
        contact_pref: ["email", "sms", "inapp"].includes(donor.contactPref) ? donor.contactPref : "inapp",
        paused: false,
      },
      { onConflict: "user_id" }
    );
    if (donorError) return res.status(500).json({ error: donorError.message });
  }

  res.status(201).json({ ok: true, email });
}

/** Look up the caller's profile, creating a bare donor profile on first sight. */
export async function ensureProfile(authUser) {
  const cols = "id, user_id, name, email, phone, role, organization, org_type, verified";
  const { data: existing } = await supabase
    .from("profiles")
    .select(cols)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existing) return existing;

  const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Donor";
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      user_id: authUser.id,
      name,
      email: authUser.email,
      phone: authUser.user_metadata?.phone || null,
      role: "donor",
      organization: null,
      org_type: null,
      verified: false,
    })
    .select(cols)
    .single();

  if (error) {
    const { data: again } = await supabase.from("profiles").select(cols).eq("user_id", authUser.id).single();
    if (again) return again;
    throw error;
  }
  return data;
}

export async function me(req, res) {
  const { data: donor } = await supabase
    .from("donors")
    .select("*")
    .eq("user_id", req.user.id)
    .maybeSingle();

  const { data: verification } = await supabase
    .from("verifications")
    .select("id, status, organization, org_type, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .maybeSingle();

  res.json({ user: req.user, donor: donorView(donor), verification: verification || null });
}
