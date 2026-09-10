import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { timeAgo } from "../lib/format.js";
import { EmptyState, ErrorBanner, PageHeader, Spinner } from "../components/ui.jsx";

const TYPE_STYLE = {
  alert: { label: "Alert", chip: "bg-blood-100 dark:bg-blood-500/15 text-blood-800 dark:text-blood-300" },
  response: { label: "Response", chip: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  contact: { label: "Privacy", chip: "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300" },
  message: { label: "Message", chip: "bg-violet-100 dark:bg-violet-500/15 text-violet-800 dark:text-violet-300" },
  moderation: { label: "Moderation", chip: "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  verification: { label: "Verification", chip: "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300" },
  thanks: { label: "Thank you", chip: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  status: { label: "Update", chip: "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200" },
  info: { label: "Info", chip: "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200" },
};

export default function Notifications() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/notifications", { token });
      setItems(data.notifications);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await api("/api/notifications/all/read", { method: "POST", token });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Inbox"
        subtitle="Every alert, response and privacy event, in one place."
        actions={
          items.some((n) => !n.read) && (
            <button className="btn-secondary" onClick={markAllRead}>
              Mark all read
            </button>
          )
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet">
          Alerts for requests near you, and updates on requests you posted, will show up here.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const style = TYPE_STYLE[item.type] || TYPE_STYLE.info;
            return (
              <li
                key={item.id}
                className={`card p-4 ${item.read ? "opacity-70" : "border-l-4 border-l-blood-500"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${style.chip}`}>{style.label}</span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">{timeAgo(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-900 dark:text-stone-50">{item.title}</p>
                {item.body && <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{item.body}</p>}
                {item.requestId && (
                  <Link to={`/requests/${item.requestId}`} className="mt-2 inline-block text-sm font-semibold text-blood-700 dark:text-blood-300 hover:underline">
                    Open request →
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
