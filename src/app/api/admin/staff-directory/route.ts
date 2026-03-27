/**
 * GET /api/admin/staff-directory
 * Roles por uid (collectionGroup users) + playerLogins. Para pestaña Usuarios del gerente.
 */

import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const db = getAdminFirestore();

    const [usersSnap, loginsSnap] = await Promise.all([
      db.collectionGroup('users').get(),
      db.collection('playerLogins').get(),
    ]);

    type RoleRow = {
      role: string;
      displayName?: string;
      subcomisionId: string;
      socioId?: string;
    };
    const rolesByUserId: Record<string, RoleRow> = {};

    for (const d of usersSnap.docs) {
      const subcomisionId = d.ref.parent.parent?.id;
      if (!subcomisionId) continue;
      const data = d.data() as { role?: string; displayName?: string; socioId?: string };
      if (!data.role) continue;
      rolesByUserId[d.id] = {
        role: data.role,
        displayName: data.displayName,
        subcomisionId,
        socioId: data.socioId,
      };
    }

    const playerLinksByDocId: Record<string, { schoolId: string; playerId: string }> = {};
    for (const d of loginsSnap.docs) {
      const data = d.data() as { schoolId?: string; playerId?: string; subcomisionId?: string; socioId?: string };
      const schoolId = data.subcomisionId ?? data.schoolId;
      const pid = data.socioId ?? data.playerId;
      if (schoolId && pid) {
        playerLinksByDocId[d.id] = { schoolId, playerId: pid };
      }
    }

    return NextResponse.json({ rolesByUserId, playerLinksByDocId });
  } catch (e) {
    console.error('[admin/staff-directory]', e);
    return NextResponse.json({ error: 'Error al cargar directorio de staff' }, { status: 500 });
  }
}
