'use client';

import { useUser } from './use-user';
import { useFirestore } from '../provider';
import type { SubcomisionUser, UserProfile, SubcomisionMembership } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { usePathname, useSearchParams } from 'next/navigation';

function membershipRolePriority(role: string): number {
  const order = ['admin_subcomision', 'encargado_deportivo', 'editor', 'viewer', 'player'] as const;
  const i = order.indexOf(role as (typeof order)[number]);
  return i === -1 ? 99 : i;
}

// This type extends SubcomisionMembership to include the full user data found in the subcollection.
type FullSubcomisionMembership = SubcomisionMembership & Omit<SubcomisionUser, 'id'> & { socioId?: string; schoolId?: string; playerId?: string };

/**
 * A hook to get the complete profile for the current user.
 * Usa la API /api/auth/profile como fuente principal (evita "Missing or insufficient permissions" en cliente).
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const schoolIdFromNavigation = useMemo(() => {
    const q = searchParams.get('schoolId') ?? searchParams.get('subcomisionId');
    if (q) return q;
    let m = pathname.match(/^\/dashboard\/subcomisiones\/([^/]+)/);
    if (m?.[1]) return m[1];
    m = pathname.match(/^\/dashboard\/schools\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname, searchParams]);

  const [memberships, setMemberships] = useState<FullSubcomisionMembership[] | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsSuperAdmin(false);
      setMemberships([]);
      setProfileLoading(false);
      return;
    }

    if (user.email === 'abengolea1@gmail.com') {
      setIsSuperAdmin(true);
      setMemberships([]);
      setProfileLoading(false);
      return;
    }

    const emailNorm = (user.email ?? '').trim().toLowerCase();
    if (!emailNorm) {
      setMemberships([]);
      setProfileLoading(false);
      return;
    }

    // API primero: no depende de permisos Firestore en cliente (evita collectionGroup/platformUsers)
    let cancelled = false;
    user.getIdToken().then(async (token) => {
      if (cancelled) return;
      try {
        const res = await fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } });
        const json = (await res.json()) as { profile?: UserProfile };
        if (cancelled) return;
        if (json.profile?.isSuperAdmin) {
          setIsSuperAdmin(true);
          setMemberships([]);
          setProfileLoading(false);
          return;
        }
        if (json.profile?.memberships?.length) {
          const userMemberships: FullSubcomisionMembership[] = json.profile.memberships.map((m) => ({
            subcomisionId: m.subcomisionId ?? (m as { schoolId?: string }).schoolId ?? '',
            schoolId: m.subcomisionId ?? (m as { schoolId?: string }).schoolId ?? '',
            role: m.role,
            displayName: m.displayName ?? '',
            email: m.email ?? emailNorm,
            socioId: (m as { socioId?: string }).socioId,
            playerId: (m as { playerId?: string }).playerId,
          })).sort((a, b) => membershipRolePriority(a.role) - membershipRolePriority(b.role));
          setMemberships(userMemberships);
          setProfileLoading(false);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      // Fallback jugador: socioLogins (el usuario puede leer su propio doc según reglas)
      if (cancelled) return;
      const loginRef = doc(firestore, 'socioLogins', emailNorm);
      getDoc(loginRef)
        .then((loginSnap) => {
          if (cancelled) return;
          if (!loginSnap.exists()) {
            setMemberships([]);
            setProfileLoading(false);
            return;
          }
          const loginData = loginSnap.data() as { schoolId?: string; playerId?: string; subcomisionId?: string; socioId?: string };
          const schoolId = loginData.subcomisionId ?? loginData.schoolId ?? '';
          const playerId = loginData.socioId ?? loginData.playerId ?? '';
          const playerRef = doc(firestore, `subcomisiones/${schoolId}/socios/${playerId}`);
          return getDoc(playerRef).then((playerSnap) => {
            if (cancelled) return;
            if (!playerSnap.exists()) {
              setMemberships([]);
            } else {
              const socioData = playerSnap.data() as { firstName?: string; lastName?: string; status?: string; nombre?: string; apellido?: string };
              const status = socioData.status ?? (socioData as { estaActivo?: boolean }).estaActivo;
              if (status === 'active' || status === true) {
                const displayName = ([socioData.nombre ?? socioData.firstName, socioData.apellido ?? socioData.lastName].filter(Boolean).join(' ') || user.email) ?? 'Socio';
                setMemberships([{
                  subcomisionId: schoolId,
                  schoolId,
                  role: 'player',
                  displayName,
                  email: user.email!,
                  playerId,
                  socioId: playerId,
                }]);
              } else {
                setMemberships([]);
              }
            }
            setProfileLoading(false);
          });
        })
        .catch(() => {
          if (!cancelled) {
            setMemberships([]);
            setProfileLoading(false);
          }
        });
    });

    return () => { cancelled = true; };
  }, [user, authLoading, firestore]);

  const loading = authLoading || profileLoading;

  const activeMembership = useMemo(() => {
    if (!memberships || memberships.length === 0) return null;
    if (schoolIdFromNavigation) {
      const found = memberships.find((m) => m.subcomisionId === schoolIdFromNavigation);
      if (found) return found;
    }
    return [...memberships].sort((a, b) => membershipRolePriority(a.role) - membershipRolePriority(b.role))[0];
  }, [memberships, schoolIdFromNavigation]);

  const profile: UserProfile | null = useMemo(() => {
    if (loading || !user) {
      return null;
    }

    // Handle super admin case
    if (isSuperAdmin) {
      return {
        id: user.uid,
        uid: user.uid,
        displayName: user.displayName || user.email || 'Super Admin',
        email: user.email!,
        role: 'admin_subcomision', // Super admin has effectively the highest school role
        isSuperAdmin: true,
        activeSchoolId: undefined, // Super admin is not tied to one school
        memberships: [],
      };
    }

    // Handle regular user. They need at least one membership to have a profile.
    if (!memberships || memberships.length === 0) {
      return null; // This is what triggers the "pending approval" page
    }

    if (!activeMembership) {
      return null;
    }
    const subcomisionId = activeMembership.subcomisionId ?? (activeMembership as { schoolId?: string }).schoolId;
    const socioId = activeMembership.socioId ?? (activeMembership as { playerId?: string }).playerId;

    return {
      ...activeMembership,
      id: user.uid,
      uid: user.uid,
      isSuperAdmin: false,
      activeSubcomisionId: subcomisionId,
      activeSchoolId: subcomisionId,
      memberships: memberships,
      socioId: socioId,
      playerId: socioId,
    };
  }, [loading, user, isSuperAdmin, memberships, activeMembership]);


  const isReady = !loading;

  return {
    user,
    profile,
    loading,
    isReady,
    activeSchoolId: profile?.activeSchoolId,
    isAdmin: isSuperAdmin || profile?.role === 'admin_subcomision',
    isEncargadoDeportivo: profile?.role === 'encargado_deportivo',
    isPlayer: profile?.role === 'player',
    isSuperAdmin: isSuperAdmin,
  };
}
