'use client';

import { useState, useEffect } from 'react';
import { useUserProfile } from '@/firebase';
import type { Subcomision } from '@/lib/types';
import { toDateSafe } from '@/lib/utils';

export function useSubcomisionesList() {
  const { user, isSuperAdmin, isReady } = useUserProfile();
  const [data, setData] = useState<(Subcomision & { createdAt: Date })[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !isSuperAdmin || !user) {
      setLoading(!isReady);
      if (!isReady) return;
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/subcomisiones/list', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setData([]);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          const items = (Array.isArray(json) ? json : []).map((item: Record<string, unknown>) => ({
            ...item,
            createdAt: toDateSafe(item.createdAt) ?? new Date(),
          })) as (Subcomision & { createdAt: Date })[];
          setData(items);
        }
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [isReady, isSuperAdmin, user]);

  return { data, loading };
}
