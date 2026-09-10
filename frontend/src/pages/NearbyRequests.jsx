import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import RequestCard from "../components/RequestCard.jsx";
import { EmptyState, ErrorBanner, PageHeader, Spinner } from "../components/ui.jsx";

const RADII = [10, 25, 50, 100];

export default function NearbyRequests() {
  const { token, donor } = useAuth();
  const [radiusKm, setRadiusKm] = useState(25);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/requests/nearby?radiusKm=${radiusKm}`, { token });
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token, radiusKm]);

  useEffect(() => {
    load();
  }, [load]);

  if (!donor) {
    return (
      <EmptyState
        title="Add your blood group and location first"
        action={<Link to="/profile" className="btn-primary">Set up my donor profile</Link>}
      >
        Nearby requests are filtered by what you can actually give and how far away it is.
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nearby requests"
        subtitle={`Open requests your ${donor.bloodGroup} blood can be used for.`}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-sm text-stone-500 dark:text-stone-400" htmlFor="radius">Within</label>
            <select
              id="radius"
              className="input w-28"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            >
              {RADII.map((km) => (
                <option key={km} value={km}>{km} km</option>
              ))}
            </select>
          </div>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <EmptyState title={`No open requests within ${radiusKm} km`}>
          Try a wider radius, or check back later — new requests appear here as soon as they are posted.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onResponded={load} />
          ))}
        </div>
      )}
    </div>
  );
}
