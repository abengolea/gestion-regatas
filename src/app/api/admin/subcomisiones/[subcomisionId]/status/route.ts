/**
 * PATCH /api/admin/subcomisiones/[subcomisionId]/status
 * Activa o suspende una subcomisión (solo gerente, Admin SDK).
 */

import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ subcomisionId: string }> }
) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { subcomisionId } = await context.params;
    if (!subcomisionId?.trim()) {
      return NextResponse.json({ error: 'Falta subcomisionId' }, { status: 400 });
    }

    const body = (await request.json()) as { status?: unknown };
    const status = body.status;
    if (status !== 'active' && status !== 'suspended') {
      return NextResponse.json({ error: 'status debe ser active o suspended' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('subcomisiones').doc(subcomisionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Subcomisión no encontrada' }, { status: 404 });
    }

    await ref.update({ status });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error('[admin/subcomisiones/status]', e);
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}
