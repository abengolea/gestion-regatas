'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import type { AccessRequest } from '@/lib/types';

function parseRequests(raw: Array<Record<string, unknown>>): AccessRequest[] {
  return raw.map((r) => ({
    id: String(r.id),
    uid: String(r.uid ?? ''),
    email: String(r.email ?? ''),
    displayName: String(r.displayName ?? ''),
    type: 'player',
    status: r.status === 'pending' || r.status === 'approved' || r.status === 'rejected' ? r.status : 'pending',
    createdAt: r.createdAt ? new Date(String(r.createdAt)) : new Date(),
  }));
}

/** Lista solicitudes de acceso pendientes vía API (evita reglas Firestore en cliente). */
export function usePendingAccessRequests(enabled: boolean) {
  const { app } = useFirebase();
  const [data, setData] = useState<AccessRequest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!enabled || !app) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) {
            setData(null);
            setLoading(false);
          }
          return;
        }
        const token = await user.getIdToken();
        const res = await fetch('/api/access-requests', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) {
            setData([]);
            setLoading(false);
          }
          return;
        }
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const json = (await res.json()) as { requests?: Array<Record<string, unknown>> };
        if (cancelled) return;
        setData(parseRequests(json.requests ?? []));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, app, version]);

  return { data, loading, error, refetch };
}
