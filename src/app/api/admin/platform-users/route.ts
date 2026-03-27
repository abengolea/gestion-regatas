/**
 * GET /api/admin/platform-users
 * Lista platformUsers. Solo gerente del club (Admin SDK).
 */

import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    const s = (val as { seconds: number }).seconds;
    return new Date(s * 1000);
  }
  if (typeof val === 'string') return new Date(val);
  return null;
}

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('platformUsers').get();

    const items = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as {
          email?: string;
          gerente_club?: boolean;
          super_admin?: boolean;
          createdAt?: unknown;
        };
        const createdAt = toDate(data.createdAt) ?? new Date(0);
        return {
          id: docSnap.id,
          email: data.email ?? '',
          gerente_club: data.gerente_club === true,
          super_admin: data.super_admin === true,
          createdAt: createdAt.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(items);
  } catch (e) {
    console.error('[admin/platform-users]', e);
    return NextResponse.json({ error: 'Error al listar usuarios de plataforma' }, { status: 500 });
  }
}
