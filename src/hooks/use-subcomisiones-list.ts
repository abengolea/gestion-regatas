'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserProfile } from '@/firebase';
import type { Subcomision } from '@/lib/types';
import { toDateSafe } from '@/lib/utils';

export function useSubcomisionesList() {
  const { user, isSuperAdmin, isReady } = useUserProfile();
  const [data, setData] = useState<(Subcomision & { createdAt: Date })[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user || !isSuperAdmin) {
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subcomisiones/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setData([]);
        return;
      }
      const json = await res.json();
      const items = (Array.isArray(json) ? json : []).map((item: Record<string, unknown>) => ({
        ...item,
        createdAt: toDateSafe(item.createdAt) ?? new Date(),
      })) as (Subcomision & { createdAt: Date })[];
      setData(items);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (!isReady || !isSuperAdmin || !user) {
      setLoading(!isReady);
      if (!isReady) return;
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/subcomisiones/list', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setData([]);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        const items = (Array.isArray(json) ? json : []).map((item: Record<string, unknown>) => ({
          ...item,
          createdAt: toDateSafe(item.createdAt) ?? new Date(),
        })) as (Subcomision & { createdAt: Date })[];
        setData(items);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isReady, isSuperAdmin, user]);

  return { data, loading, refetch };
}
