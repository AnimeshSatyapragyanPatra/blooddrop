// In-memory stand-in for Supabase (Postgres + Auth + RPC), used when MOCK_DB=1.
// Persists to backend/.data/db.json so a demo survives restarts.
// Implements only the subset of the supabase-js API this app actually uses,
// including the `match_donors` RPC that PostGIS provides in a real project.
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { haversineKm } from "./geo.js";
import {
  CENTRE, daysAgo, hoursFromNow, offset, SEED_ACCOUNTS, SEED_DONORS, AREAS,
} from "./demoData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local dev persists next to the code. Serverless has a read-only FS, so fall
// back to /tmp — ephemeral, which is fine for a demo deployment.
const READ_ONLY_FS = Boolean(process.env.VERCEL || process.env.AWS_REGION || process.env.NOW_REGION);
const DATA_DIR =
  process.env.MOCK_DATA_DIR || (READ_ONLY_FS ? join(tmpdir(), "blooddrop") : join(__dirname, "../../.data"));
const DB_FILE = join(DATA_DIR, "db.json");

const TABLES = [
  "profiles",
  "donors",
  "requests",
  "alerts",
  "responses",
  "reports",
  "verifications",
  "notifications",
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function emptyDb() {
  const db = { users: [] };
  for (const t of TABLES) db[t] = [];
  return db;
}

let db = emptyDb();
let canPersist = true;

function persist() {
  if (!canPersist) return;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch {
    canPersist = false; // read-only filesystem — stay purely in memory
  }
}

function load() {
  try {
    if (existsSync(DB_FILE)) {
      db = { ...emptyDb(), ...JSON.parse(readFileSync(DB_FILE, "utf8")) };
      return;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  db = emptyDb();
  seed();
  persist();
}

// ---- Seed data -------------------------------------------------------------

function addUser({ email, password, name, phone }) {
  const id = randomUUID();
  db.users.push({
    id,
    email: email.toLowerCase(),
    password: hashPassword(password),
    user_metadata: { name, phone },
    created_at: new Date().toISOString(),
  });
  return id;
}

function seed() {
  const now = new Date().toISOString();
  const ids = {};

  for (const acc of SEED_ACCOUNTS) {
    const userId = addUser(acc);
    ids[acc.role === "requester" && acc.verified ? "hospital" : acc.role] = userId;
    db.profiles.push({
      id: randomUUID(),
      user_id: userId,
      name: acc.name,
      email: acc.email,
      phone: acc.phone,
      role: acc.role,
      organization: acc.organization || null,
      org_type: acc.orgType || null,
      verified: Boolean(acc.verified),
      created_at: now,
    });

    if (acc.donor) {
      const p = offset(acc.donor.km, acc.donor.bearing);
      const [a, r, d, n] = acc.donor.stats;
      db.donors.push({
        id: randomUUID(),
        user_id: userId,
        blood_group: acc.donor.group,
        lat: p.lat,
        lng: p.lng,
        area_label: "Bidhannagar, Durgapur",
        last_donation_date: acc.donor.last ? daysAgo(acc.donor.last) : null,
        contact_pref: acc.donor.pref,
        paused: false,
        alerts_received: a,
        responses_given: r,
        donations_confirmed: d,
        no_shows: n,
        created_at: now,
      });
    }
  }

  SEED_DONORS.forEach(([name, group, km, bearing, last, pref, stats, paused], i) => {
    const email = `${name.toLowerCase().split(" ")[0]}${i}@donor.test`;
    const phone = `+91 9${String(800000000 + i * 111111).slice(0, 9)}`;
    const userId = addUser({ email, password: "Donor123!", name, phone });
    const p = offset(km, bearing);
    const [a, r, d, n] = stats;

    db.profiles.push({
      id: randomUUID(),
      user_id: userId,
      name,
      email,
      phone,
      role: "donor",
      organization: null,
      org_type: null,
      verified: false,
      created_at: now,
    });
    db.donors.push({
      id: randomUUID(),
      user_id: userId,
      blood_group: group,
      lat: p.lat,
      lng: p.lng,
      area_label: `${AREAS[i % AREAS.length]}, Durgapur`,
      last_donation_date: last ? daysAgo(last) : null,
      contact_pref: pref,
      paused,
      alerts_received: a,
      responses_given: r,
      donations_confirmed: d,
      no_shows: n,
      created_at: now,
    });
  });

  // Two live requests so every screen has something to show.
  const hospitalPoint = offset(0.5, 0);
  const criticalId = randomUUID();
  db.requests.push({
    id: criticalId,
    requester_id: ids.hospital,
    patient_name: "Post-op patient (Ward 4)",
    blood_group: "O-",
    units_needed: 2,
    hospital_name: "Durgapur Mission Hospital",
    lat: hospitalPoint.lat,
    lng: hospitalPoint.lng,
    area_label: "Durgapur Mission Hospital, Benachity",
    urgency: "critical",
    needed_by: hoursFromNow(8),
    notes: "Surgery scheduled tomorrow morning. Blood bank stock is out.",
    radius_km: 20,
    status: "open",
    verified: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });

  const routinePoint = offset(3.0, 180);
  const routineId = randomUUID();
  db.requests.push({
    id: routineId,
    requester_id: ids.requester,
    patient_name: "My father",
    blood_group: "B+",
    units_needed: 1,
    hospital_name: "Sadar Hospital, Durgapur",
    lat: routinePoint.lat,
    lng: routinePoint.lng,
    area_label: "Sadar Hospital, Durgapur",
    urgency: "urgent",
    needed_by: hoursFromNow(36),
    notes: "Dialysis patient, transfusion needed within two days.",
    radius_km: 15,
    status: "open",
    verified: false,
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  });

  // Dispatch trails. Only compatible donors are ever alerted — the same rule
  // the matcher enforces (compatibleDonorGroups in lib/blood.js), so the seed
  // cannot show a state the live app would never produce.
  function seedAlert(requestId, point, donor, minutesAgo, response) {
    db.alerts.push({
      id: randomUUID(),
      request_id: requestId,
      donor_user_id: donor.user_id,
      channel: donor.contact_pref,
      status: "sent",
      distance_km: Math.round(haversineKm(point.lat, point.lng, donor.lat, donor.lng) * 10) / 10,
      sent_at: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    });
    if (response) {
      db.responses.push({
        id: randomUUID(),
        request_id: requestId,
        donor_user_id: donor.user_id,
        status: response.status,
        note: response.note,
        outcome: null,
        responded_at: new Date(Date.now() - (minutesAgo - 20) * 60 * 1000).toISOString(),
      });
    }
  }

  const byName = (name) => {
    const profile = db.profiles.find((p) => p.name === name);
    return db.donors.find((d) => d.user_id === profile?.user_id);
  };
  const demoDonor = db.donors.find((d) => d.user_id === ids.donor);

  // Critical O- request: only O- donors can help. One in, one out, one silent.
  seedAlert(criticalId, hospitalPoint, byName("Imran Khan"), 100, {
    status: "available",
    note: "Can reach the hospital within the hour.",
  });
  seedAlert(criticalId, hospitalPoint, byName("Kabir Das"), 100, {
    status: "unavailable",
    note: "Out of town until Friday.",
  });
  seedAlert(criticalId, hospitalPoint, byName("Ritu Banerjee"), 100, null);

  // Routine B+ request: O+ and B+ donors both qualify, so the demo donor has a
  // real alert waiting for them on first sign-in.
  seedAlert(routineId, routinePoint, demoDonor, 45, null);
  seedAlert(routineId, routinePoint, byName("Priya Sharma"), 45, null);

  // One open report so the moderation queue is not an empty state on first run.
  db.reports.push({
    id: randomUUID(),
    target_type: "request",
    target_id: routineId,
    reporter_id: ids.donor,
    reason: "suspicious",
    details: "Same request text was posted twice from different numbers.",
    status: "open",
    resolution_note: null,
    resolved_by: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  });

  db.notifications.push({
    id: randomUUID(),
    user_id: ids.donor,
    type: "alert",
    title: "Urgent: B+ needed nearby",
    body: "Sadar Hospital, Durgapur needs 1 unit of B+ — your O+ blood is compatible.",
    request_id: routineId,
    read: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  });
}

// ---- Query builder ---------------------------------------------------------

const TABLE_DEFAULTS = {
  profiles: () => ({ id: randomUUID(), role: "donor", verified: false, created_at: new Date().toISOString() }),
  donors: () => ({
    id: randomUUID(),
    paused: false,
    alerts_received: 0,
    responses_given: 0,
    donations_confirmed: 0,
    no_shows: 0,
    created_at: new Date().toISOString(),
  }),
  requests: () => ({ id: randomUUID(), status: "open", verified: false, created_at: new Date().toISOString() }),
  alerts: () => ({ id: randomUUID(), status: "sent", sent_at: new Date().toISOString() }),
  responses: () => ({ id: randomUUID(), outcome: null, responded_at: new Date().toISOString() }),
  reports: () => ({ id: randomUUID(), status: "open", created_at: new Date().toISOString() }),
  verifications: () => ({ id: randomUUID(), status: "pending", created_at: new Date().toISOString() }),
  notifications: () => ({ id: randomUUID(), read: false, created_at: new Date().toISOString() }),
};

function project(row, cols) {
  if (!row || !cols || cols === "*") return row ? { ...row } : row;
  const fields = cols.split(",").map((c) => c.trim()).filter((c) => c && c !== "*");
  if (fields.length === 0) return { ...row };
  const out = {};
  for (const f of fields) out[f] = row[f];
  return out;
}

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.op = "select";
    this.payload = null;
    this.cols = "*";
    this.orderBy = null;
    this.limitN = null;
    this.mode = null;
    this.countMode = null;
    this.headOnly = false;
    this.onConflict = null;
  }

  select(cols = "*", opts = {}) {
    this.cols = cols || "*";
    if (opts.count) this.countMode = opts.count;
    if (opts.head) this.headOnly = true;
    return this;
  }
  insert(payload) { this.op = "insert"; this.payload = payload; return this; }
  update(payload) { this.op = "update"; this.payload = payload; return this; }
  upsert(payload, opts = {}) {
    this.op = "upsert";
    this.payload = payload;
    this.onConflict = opts.onConflict || null;
    return this;
  }
  delete() { this.op = "delete"; return this; }

  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  neq(col, val) { this.filters.push((r) => r[col] !== val); return this; }
  gt(col, val) { this.filters.push((r) => r[col] > val); return this; }
  gte(col, val) { this.filters.push((r) => r[col] >= val); return this; }
  lt(col, val) { this.filters.push((r) => r[col] < val); return this; }
  lte(col, val) { this.filters.push((r) => r[col] <= val); return this; }
  is(col, val) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  in(col, arr) { const set = new Set(arr); this.filters.push((r) => set.has(r[col])); return this; }
  order(col, opts = {}) { this.orderBy = { col, ascending: opts.ascending !== false }; return this; }
  limit(n) { this.limitN = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybeSingle"; return this; }

  _rows() {
    let rows = db[this.table] || [];
    for (const f of this.filters) rows = rows.filter(f);
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => {
        if (a[col] === b[col]) return 0;
        if (a[col] == null) return 1;
        if (b[col] == null) return -1;
        return (a[col] < b[col] ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  _run() {
    try {
      if (this.op === "select") {
        const rows = this._rows();
        if (this.headOnly && this.countMode) return { data: null, count: rows.length, error: null };
        const mapped = rows.map((r) => project(r, this.cols));
        if (this.mode === "single") {
          if (!mapped.length) return { data: null, error: { message: "No rows found", code: "PGRST116" } };
          return { data: mapped[0], error: null };
        }
        if (this.mode === "maybeSingle") return { data: mapped[0] || null, error: null };
        return { data: mapped, count: this.countMode ? rows.length : undefined, error: null };
      }

      if (this.op === "insert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = items.map((item) => {
          const row = { ...TABLE_DEFAULTS[this.table]?.(), ...item };
          db[this.table].push(row);
          return row;
        });
        persist();
        const mapped = inserted.map((r) => project(r, this.cols));
        return { data: this.mode === "single" ? mapped[0] : mapped, error: null };
      }

      if (this.op === "update") {
        const rows = this._rows();
        rows.forEach((r) => Object.assign(r, this.payload));
        persist();
        const mapped = rows.map((r) => project(r, this.cols));
        if (this.mode === "single") {
          if (!mapped.length) return { data: null, error: { message: "No rows found" } };
          return { data: mapped[0], error: null };
        }
        return { data: mapped, error: null };
      }

      if (this.op === "upsert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const keys = (this.onConflict || "id").split(",").map((k) => k.trim());
        const result = items.map((item) => {
          const existing = db[this.table].find((r) => keys.every((k) => r[k] === item[k]));
          if (existing) {
            Object.assign(existing, item);
            return existing;
          }
          const row = { ...TABLE_DEFAULTS[this.table]?.(), ...item };
          db[this.table].push(row);
          return row;
        });
        persist();
        const mapped = result.map((r) => project(r, this.cols));
        return { data: this.mode === "single" ? mapped[0] : mapped, error: null };
      }

      if (this.op === "delete") {
        const toRemove = new Set(this._rows());
        db[this.table] = db[this.table].filter((r) => !toRemove.has(r));
        persist();
        return { data: null, error: null };
      }

      return { data: null, error: { message: `Unsupported op ${this.op}` } };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  then(resolve, reject) {
    try {
      resolve(this._run());
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }
}

// ---- RPC -------------------------------------------------------------------
// Mirrors the PostGIS function in supabase/migrations/20260909000001_init_schema.sql so the
// controllers have one code path whether or not Supabase is configured.

const RPCS = {
  match_donors({ p_lat, p_lng, p_radius_km, p_groups }) {
    const groups = new Set(p_groups || []);
    const rows = [];

    for (const donor of db.donors) {
      if (groups.size && !groups.has(donor.blood_group)) continue;
      if (!Number.isFinite(donor.lat) || !Number.isFinite(donor.lng)) continue;

      const distance = haversineKm(p_lat, p_lng, donor.lat, donor.lng);
      if (distance > p_radius_km) continue;

      const profile = db.profiles.find((p) => p.user_id === donor.user_id);
      rows.push({
        user_id: donor.user_id,
        name: profile?.name || "Donor",
        email: profile?.email || null,
        phone: profile?.phone || null,
        blood_group: donor.blood_group,
        area_label: donor.area_label,
        lat: donor.lat,
        lng: donor.lng,
        last_donation_date: donor.last_donation_date,
        contact_pref: donor.contact_pref,
        paused: donor.paused,
        alerts_received: donor.alerts_received,
        responses_given: donor.responses_given,
        donations_confirmed: donor.donations_confirmed,
        no_shows: donor.no_shows,
        distance_km: Math.round(distance * 100) / 100,
      });
    }

    return rows.sort((a, b) => a.distance_km - b.distance_km);
  },
};

load();

export const mockSupabase = {
  from(table) {
    if (!TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
    return new Query(table);
  },
  async rpc(name, params) {
    const fn = RPCS[name];
    if (!fn) return { data: null, error: { message: `Unknown RPC: ${name}` } };
    try {
      return { data: fn(params || {}), error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },
  auth: {
    async getUser(token) {
      if (!token || !token.startsWith("mock.")) {
        return { data: { user: null }, error: { message: "Invalid token" } };
      }
      const user = db.users.find((u) => u.id === token.slice(5));
      if (!user) return { data: { user: null }, error: { message: "User not found" } };
      return { data: { user: { id: user.id, email: user.email, user_metadata: user.user_metadata } }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const user = db.users.find((u) => u.email === String(email).toLowerCase());
      if (!user || !verifyPassword(password, user.password)) {
        return { data: { session: null }, error: { message: "Invalid email or password" } };
      }
      return {
        data: {
          session: {
            access_token: `mock.${user.id}`,
            user: { id: user.id, email: user.email, user_metadata: user.user_metadata },
          },
        },
        error: null,
      };
    },
    admin: {
      async createUser({ email, password, user_metadata }) {
        const normalized = String(email).toLowerCase();
        if (db.users.some((u) => u.email === normalized)) {
          return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
        }
        const id = addUser({ email: normalized, password, name: user_metadata?.name, phone: user_metadata?.phone });
        persist();
        const user = db.users.find((u) => u.id === id);
        return { data: { user: { id: user.id, email: user.email, user_metadata: user.user_metadata } }, error: null };
      },
    },
  },
};

export { SEED_ACCOUNTS };
