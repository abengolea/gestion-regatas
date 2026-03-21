/**
 * GET /api/subcomisiones/list
 * Lista todas las subcomisiones. Solo super admins (gerente_club o super_admin).
 * Usa firebase-admin para evitar restricciones de reglas del cliente.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifySuperAdmin } from '@/lib/auth-server';
import type { Subcomision } from '@/lib/types';

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
      return NextResponse.json({ error: 'No autorizado. Solo super admins.' }, { status: 401 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('subcomisiones').orderBy('createdAt', 'desc').get();

    const items: (Subcomision & { createdAt: Date })[] = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = toDate(data.createdAt) ?? new Date();
      return {
        id: doc.id,
        name: data.name ?? '',
        slug: data.slug,
        city: data.city ?? '',
        province: data.province ?? '',
        address: data.address ?? '',
        logoUrl: data.logoUrl,
        status: data.status ?? 'active',
        createdAt,
      };
    });

    return NextResponse.json(
      items.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
    );
  } catch (e) {
    console.error('[subcomisiones/list]', e);
    return NextResponse.json(
      { error: 'Error al listar subcomisiones' },
      { status: 500 }
    );
  }
}
