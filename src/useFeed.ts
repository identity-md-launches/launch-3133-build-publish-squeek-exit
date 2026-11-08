import { useEffect, useState } from 'react';
import { backoffMs, FeedError, fetchFeed, POLL_MS } from './api';
export type Feed<T> = { data: T | null; fetchedAt: number | null; error: string | null; loading: boolean; nextAt: number | null };
export function useFeed<T>(path: '/status' | '/economy/state', parse: (body: unknown) => T) {
  const [feed, setFeed] = useState<Feed<T>>({ data: null, fetchedAt: null, error: null, loading: true, nextAt: null });
  useEffect(() => {
    let alive = true, failures = 0, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (!alive) return;
      let delay = POLL_MS;
      try {
        const data = await fetchFeed(path, parse, controller.signal);
        failures = 0;
        if (alive) setFeed({ data, fetchedAt: Date.now(), error: null, loading: false, nextAt: Date.now() + delay });
      } catch (error) {
        if (!alive) return;
        failures++;
        delay = backoffMs(failures, error instanceof FeedError ? error.retryAfter : 0);
        setFeed(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Feed request failed.', nextAt: Date.now() + delay }));
      }
      // Scheduled after completion: never overlap, and never poll sooner than 15s.
      if (alive) timer = setTimeout(poll, delay);
    }
    void poll();
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [path, parse]);
  return feed;
}
