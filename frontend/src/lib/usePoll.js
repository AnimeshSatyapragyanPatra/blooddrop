import { useEffect, useRef } from "react";

/**
 * Re-run `fn` on an interval, but only while the tab is actually visible.
 *
 * A backgrounded tab makes no requests at all. Bringing it forward refetches
 * so the user never looks at data that went stale while they were away —
 * but not if it already ran moments ago, or flicking between tabs would fire
 * a request every time. Without any of this, every open tab hits the API
 * forever, which on a serverless host is a bill rather than just noise.
 */
export function usePoll(fn, intervalMs, { minGapMs = 5000 } = {}) {
  const saved = useRef(fn);
  const lastRun = useRef(0);
  saved.current = fn;

  useEffect(() => {
    let timer = null;

    const run = () => {
      lastRun.current = Date.now();
      saved.current();
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (!timer) timer = setInterval(run, intervalMs);
    };

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
        return;
      }
      // Refresh on return, unless we just ran — this is what stops a burst of
      // requests when someone flicks quickly between tabs.
      if (Date.now() - lastRun.current > minGapMs) run();
      start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, minGapMs]);
}
