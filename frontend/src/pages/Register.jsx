import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import LocationField from "../components/LocationField.jsx";
import BloodGroupPicker from "../components/BloodGroupPicker.jsx";
import { ErrorBanner, Notice } from "../components/ui.jsx";

export default function Register() {
  const { user, register, homePath } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState("donor");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", organization: "" });
  const [bloodGroup, setBloodGroup] = useState("");
  const [location, setLocation] = useState(null);
  const [areaLabel, setAreaLabel] = useState("");
  const [lastDonationDate, setLastDonationDate] = useState("");
  const [contactPref, setContactPref] = useState("inapp");
  const [groups, setGroups] = useState([]);
  const [gapDays, setGapDays] = useState(90);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/config")
      .then((config) => {
        setGroups(config.bloodGroups);
        setGapDays(config.donationGapDays);
      })
      .catch(() => setGroups(["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]));
  }, []);

  if (user) return <Navigate to={homePath()} replace />;

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        ...form,
        role,
        donor:
          role === "donor"
            ? {
                bloodGroup,
                lat: location?.lat,
                lng: location?.lng,
                areaLabel,
                lastDonationDate: lastDonationDate || null,
                contactPref,
              }
            : null,
      });
      navigate(role === "donor" ? "/home" : "/requests");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // Everything the form still needs, named in the user's words. Checked here so
  // a long form never fails on a server round trip for something visible.
  const missing = [];
  if (!form.name.trim()) missing.push("your name");
  if (!form.phone.trim()) missing.push("a phone number");
  if (!form.email.trim()) missing.push("an email");
  if (form.password.length < 6) missing.push("a password of at least 6 characters");
  if (role === "donor") {
    if (!bloodGroup) missing.push("your blood group");
    if (!location) missing.push("a location on the map");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">Create your account</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-blood-700 dark:text-blood-300 hover:underline">
          Sign in
        </Link>
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <fieldset>
          <legend className="label">I am signing up to…</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["donor", "Donate blood", "Get alerted when someone nearby needs your blood group"],
              ["requester", "Request blood", "Post emergency requests for a patient, hospital or blood bank"],
            ].map(([value, title, description]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  role === value ? "border-blood-500 bg-blood-50 dark:bg-blood-500/10 ring-2 ring-blood-100 dark:ring-blood-500/20" : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-stone-900 dark:text-stone-50">{title}</span>
                <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">{description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" value={form.name} onChange={set("name")} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              className="input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+91 98765 43210"
              required
            />
            <p className="hint">Stays masked until you accept a request.</p>
          </div>
          <div>
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" className="input" type="email" value={form.email} onChange={set("email")} required />
          </div>
          <div>
            <label className="label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="input"
              type="password"
              minLength={6}
              value={form.password}
              onChange={set("password")}
              required
            />
          </div>
        </div>

        {role === "requester" && (
          <div>
            <label className="label" htmlFor="organization">
              Hospital / blood bank <span className="font-normal text-stone-400 dark:text-stone-500">(optional)</span>
            </label>
            <input id="organization" className="input" value={form.organization} onChange={set("organization")} />
            <p className="hint">
              You can apply for a verified badge after signing up — verified requests get answered far more often.
            </p>
          </div>
        )}

        {role === "donor" && (
          <>
            <BloodGroupPicker
              value={bloodGroup}
              onChange={setBloodGroup}
              groups={groups}
              required
              hint="Tap your group — this is what we match requests against."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="lastDonation">
                  Last donation <span className="font-normal text-stone-400 dark:text-stone-500">(optional)</span>
                </label>
                <input
                  id="lastDonation"
                  className="input"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                />
                <p className="hint">We hide you from searches until {gapDays} days have passed.</p>
              </div>
              <div>
                <label className="label" htmlFor="area">Area name</label>
                <input
                  id="area"
                  className="input"
                  value={areaLabel}
                  onChange={(e) => setAreaLabel(e.target.value)}
                  placeholder="e.g. Benachity, Durgapur"
                />
              </div>
              <div>
                <label className="label" htmlFor="pref">Alert me by</label>
                <select id="pref" className="input" value={contactPref} onChange={(e) => setContactPref(e.target.value)}>
                  <option value="inapp">In-app inbox</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>

            <LocationField
              value={location}
              onChange={setLocation}
              label="Where should we match you from?"
              hint="Click the map near your home or workplace — only an approximate area is ever shown to others."
            />

            <Notice tone="info">
              Your exact pin is never shared. Other users see a rounded area and a distance, and your phone number only
              after you accept a request.
            </Notice>
          </>
        )}

        {missing.length > 0 && (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Still needed: {missing.join(", ")}.
          </p>
        )}

        <button className="btn-primary w-full" disabled={busy || missing.length > 0}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
