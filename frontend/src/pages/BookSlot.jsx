import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, qs } from "../services/api.js";
import { distance } from "../lib/format.js";
import MapPicker from "../components/MapPicker.jsx";
import { BloodTag, EmptyState, ErrorBanner, Notice, PageHeader, Spinner } from "../components/ui.jsx";

const TYPE_LABEL = { hospital: "Hospital", blood_bank: "Blood bank" };

/**
 * Where a donor actually goes. Blood is collected, screened and cross-matched
 * at a licensed facility before it reaches a patient, so accepting an alert
 * leads here rather than to the requester's phone number.
 */
export default function BookSlot() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState(null);
  const [days, setDays] = useState([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/api/requests/${id}`, { token });
        setRequest(data.request);
        const list = await api(
          `/api/facilities${qs({ lat: data.request.lat, lng: data.request.lng })}`,
          { token }
        );
        setFacilities(list.facilities);
        setFacilityId(data.request.facilityId || list.facilities[0]?.id || null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  const loadSlots = useCallback(async () => {
    if (!facilityId) return;
    setLoadingSlots(true);
    setChosen(null);
    try {
      const data = await api(`/api/facilities/${facilityId}/slots`, { token });
      setDays(data.days);
      setDayIndex(0);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingSlots(false);
    }
  }, [facilityId, token]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/requests/${id}/book`, {
        method: "POST",
        token,
        body: { facilityId, scheduledAt: chosen },
      });
      navigate("/home");
    } catch (err) {
      setError(err);
      loadSlots(); // someone may have taken the slot while this page was open
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner rows={2} />;
  if (!request) return <EmptyState title="Request not found" />;

  const facility = facilities.find((f) => f.id === facilityId);
  const day = days[dayIndex];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Book your donation slot"
        subtitle="You donate at a licensed blood bank — they screen and cross-match the blood before it reaches the patient."
        actions={<button className="btn-ghost" onClick={() => navigate(-1)}>Back</button>}
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <BloodTag group={request.bloodGroup} size="lg" />
        <div className="min-w-48 flex-1">
          <p className="text-base font-semibold text-stone-900 dark:text-stone-50">
            {request.unitsNeeded} unit{request.unitsNeeded === 1 ? "" : "s"} of {request.bloodGroup}
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            For the request at {request.hospitalName}
          </p>
        </div>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Where
        </h2>
        <div className="mt-3 grid gap-2">
          {facilities.map((f) => (
            <label
              key={f.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                facilityId === f.id
                  ? "border-blood-500 bg-blood-50 ring-2 ring-blood-100 dark:bg-blood-500/10 dark:ring-blood-500/20"
                  : "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              }`}
            >
              <input
                type="radio"
                name="facility"
                className="mt-1"
                checked={facilityId === f.id}
                onChange={() => setFacilityId(f.id)}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-stone-900 dark:text-stone-50">{f.name}</span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  {TYPE_LABEL[f.type]} · {f.address} · open {f.openTime}–{f.closeTime}
                  {f.distanceKm != null && <> · {distance(f.distanceKm)} from the hospital</>}
                </span>
                {f.licenceRef && (
                  <span className="block text-xs text-stone-400 dark:text-stone-500">Licence {f.licenceRef}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">When</h2>

        {loadingSlots ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Loading times…</p>
        ) : days.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            No slots available in the next few days. Try another facility.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setDayIndex(i);
                    setChosen(null);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    i === dayIndex
                      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                      : "border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {day?.slots.map((slot) => (
                <button
                  key={slot.at}
                  type="button"
                  disabled={slot.full}
                  onClick={() => setChosen(slot.at)}
                  title={slot.full ? "Fully booked" : `${slot.remaining} place(s) left`}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    chosen === slot.at
                      ? "border-blood-600 bg-blood-600 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:border-blood-300 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {facility && (
        <div className="mb-6">
          <MapPicker value={{ lat: facility.lat, lng: facility.lng }} height={200} zoom={13} />
        </div>
      )}

      <div className="mb-6">
        <Notice tone="info">
          Bring photo ID. The blood bank confirms your donation afterwards — that is what resets your 90-day clock
          and counts towards your record, so neither you nor the requester has to be taken at their word.
        </Notice>
      </div>

      <button className="btn-primary w-full" onClick={confirm} disabled={!chosen || saving}>
        {saving ? "Booking…" : chosen ? "Confirm this slot" : "Pick a time to continue"}
      </button>
    </div>
  );
}
