import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import LocationField from "../components/LocationField.jsx";
import {
  EligibilityPill, ErrorBanner, Notice, PageHeader, ReliabilityMeter, StatTile,
} from "../components/ui.jsx";

export default function DonorProfile() {
  const { token, donor, refresh } = useAuth();
  const [groups, setGroups] = useState(["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]);
  const [gapDays, setGapDays] = useState(90);
  const [form, setForm] = useState({ bloodGroup: "", areaLabel: "", lastDonationDate: "", contactPref: "inapp" });
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/config")
      .then((config) => {
        setGroups(config.bloodGroups);
        setGapDays(config.donationGapDays);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!donor) return;
    setForm({
      bloodGroup: donor.bloodGroup,
      areaLabel: donor.areaLabel || "",
      lastDonationDate: donor.lastDonationDate || "",
      contactPref: donor.contactPref,
    });
    setLocation({ lat: donor.lat, lng: donor.lng });
  }, [donor]);

  const set = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setSaved(false);
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/me/donor", {
        method: "PUT",
        token,
        body: { ...form, lastDonationDate: form.lastDonationDate || null, lat: location?.lat, lng: location?.lng },
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={donor ? "My donor profile" : "Become a donor"}
        subtitle={
          donor
            ? "Keeping this current is what makes the matching accurate."
            : "Add your blood group and area to start receiving alerts."
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {saved && <div className="mb-4"><Notice tone="good">Profile saved.</Notice></div>}

      {donor && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatTile label="Alerts received" value={donor.reliability.alertsReceived} />
          <StatTile label="Answered" value={donor.reliability.responsesGiven} />
          <StatTile label="Confirmed donations" value={donor.reliability.donationsConfirmed} tone="good" />
        </div>
      )}

      {donor && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <EligibilityPill eligibility={donor.eligibility} />
            <p className="mt-2 text-sm text-stone-600">
              {donor.eligibility.eligible
                ? "You are visible to nearby requests right now."
                : `Hidden from matching until ${donor.eligibility.eligibleOn}.`}
            </p>
          </div>
          <div className="w-full sm:w-64">
            <ReliabilityMeter reliability={donor.reliability} />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="group">Blood group</label>
            <select id="group" className="input" value={form.bloodGroup} onChange={set("bloodGroup")} required>
              <option value="">Select…</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="last">Last donation date</label>
            <input
              id="last"
              className="input"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.lastDonationDate}
              onChange={set("lastDonationDate")}
            />
            <p className="hint">
              We hide you from matching for {gapDays} days after this date. A confirmed donation updates it for you.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="area">Area name</label>
            <input id="area" className="input" value={form.areaLabel} onChange={set("areaLabel")} placeholder="e.g. Benachity, Durgapur" />
          </div>
          <div>
            <label className="label" htmlFor="pref">Alert me by</label>
            <select id="pref" className="input" value={form.contactPref} onChange={set("contactPref")}>
              <option value="inapp">In-app inbox</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
            <p className="hint">Every alert also lands in your in-app inbox.</p>
          </div>
        </div>

        <LocationField
          value={location}
          onChange={(next) => {
            setLocation(next);
            setSaved(false);
          }}
          label="My location"
          hint="Click the map near your home or workplace."
        />

        <Notice tone="info">
          Other users only ever see a rounded area and a distance — never your exact pin, and never your phone number
          until you accept a request.
        </Notice>

        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : donor ? "Save changes" : "Register as a donor"}
        </button>
      </form>
    </div>
  );
}
