/**
 * GET /api/admin/subcomision-users?subcomisionId=
 * Usuarios staff de una subcomisión (colección users).
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

    const { searchParams } = new URL(request.url);
    const subcomisionId = searchParams.get('subcomisionId')?.trim();
    if (!subcomisionId) {
      return NextResponse.json({ error: 'Falta subcomisionId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('subcomisiones').doc(subcomisionId).collection('users').get();

    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return { id: d.id, ...data };
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error('[admin/subcomision-users]', e);
    return NextResponse.json({ error: 'Error al listar usuarios de la subcomisión' }, { status: 500 });
  }
}
