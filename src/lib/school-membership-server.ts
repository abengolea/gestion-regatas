/**
 * Membresías en subcomisiones (servidor, Admin SDK).
 * Usado por /api/auth/profile y rutas que deben replicar permisos de staff sin depender de reglas de cliente.
 */

import { getAdminFirestore } from '@/lib/firebase-admin';

export type SubcomisionMembershipRow = {
  subcomisionId: string;
  role: string;
  displayName?: string;
  email?: string;
};

const LIST_ACCESS_REQUEST_ROLES = ['admin_subcomision', 'encargado_deportivo', 'editor', 'viewer'] as const;
const APPROVE_ACCESS_REQUEST_ROLES = ['admin_subcomision', 'encargado_deportivo'] as const;

export async function listSubcomisionMembershipsByEmail(email: string): Promise<SubcomisionMembershipRow[]> {
  const db = getAdminFirestore();
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return [];

  const out: SubcomisionMembershipRow[] = [];

  try {
    const usersSnap = await db.collectionGroup('users').where('email', '==', emailNorm).get();
    usersSnap.docs.forEach((d) => {
      const parent = d.ref.parent.parent;
      if (!parent) return;
      const data = d.data() as { role?: string; displayName?: string; email?: string };
      if (!data.role) return;
      out.push({
        subcomisionId: parent.id,
        role: data.role,
        displayName: data.displayName,
        email: data.email ?? emailNorm,
      });
    });
  } catch {
    const subSnap = await db.collection('subcomisiones').get();
    for (const subDoc of subSnap.docs) {
      const subcomisionId = subDoc.id;
      const q = await db
        .collection('subcomisiones')
        .doc(subcomisionId)
        .collection('users')
        .where('email', '==', emailNorm)
        .limit(1)
        .get();
      if (q.empty) continue;
      const d = q.docs[0];
      const data = d.data() as { role?: string; displayName?: string; email?: string };
      if (!data.role) continue;
      out.push({
        subcomisionId,
        role: data.role,
        displayName: data.displayName,
        email: data.email ?? emailNorm,
      });
    }
  }

  return out;
}

export async function isGerenteClubFromDb(uid: string, email: string | undefined): Promise<boolean> {
  if (email === 'abengolea1@gmail.com') return true;
  const db = getAdminFirestore();
  const platformSnap = await db.collection('platformUsers').doc(uid).get();
  const data = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
  return data?.gerente_club === true || data?.super_admin === true;
}

export function canListPendingAccessRequests(
  memberships: SubcomisionMembershipRow[],
  isGerente: boolean
): boolean {
  if (isGerente) return true;
  return memberships.some((m) => (LIST_ACCESS_REQUEST_ROLES as readonly string[]).includes(m.role));
}

/** Puede aprobar vinculando a jugadores en `subcomisionId` (admin o entrenador de esa sede, o gerente). */
export function canApproveAccessRequestsForSchool(
  memberships: SubcomisionMembershipRow[],
  isGerente: boolean,
  subcomisionId: string
): boolean {
  if (isGerente) return true;
  return memberships.some(
    (m) =>
      m.subcomisionId === subcomisionId &&
      (APPROVE_ACCESS_REQUEST_ROLES as readonly string[]).includes(m.role)
  );
}
