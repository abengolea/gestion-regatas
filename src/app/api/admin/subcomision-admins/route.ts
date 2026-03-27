/**
 * GET /api/admin/subcomision-admins
 * Mapa subcomisionId -> responsable (primer usuario admin_subcomision por escuela). Solo gerente.
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
    const snap = await db.collectionGroup('users').get();

    const map: Record<string, { displayName: string; email: string }> = {};

    for (const d of snap.docs) {
      const data = d.data() as { role?: string; displayName?: string; email?: string };
      if (data.role !== 'admin_subcomision') continue;
      const parent = d.ref.parent.parent;
      if (!parent) continue;
      const subcomisionId = parent.id;
      if (map[subcomisionId]) continue;
      map[subcomisionId] = {
        displayName: data.displayName ?? '',
        email: data.email ?? '',
      };
    }

    return NextResponse.json(map);
  } catch (e) {
    console.error('[admin/subcomision-admins]', e);
    return NextResponse.json({ error: 'Error al cargar responsables' }, { status: 500 });
  }
}
