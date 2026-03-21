/**
 * GET /api/platform-fee/delinquents
 * Lista escuelas en mora de mensualidad (solo super admin).
 * El link de pago se genera con POST /api/platform-fee/intent cuando el usuario hace clic.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { computeClubFeeDelinquents } from '@/lib/payments/platform-fee';
import { verifySuperAdmin } from '@/lib/auth-server';
import type { SchoolFeeDelinquent } from '@/lib/types/platform-fee';

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'Solo super admin' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const delinquents = await computeClubFeeDelinquents(db);

    return NextResponse.json({
      delinquents: delinquents.map((d: SchoolFeeDelinquent) => ({
        ...d,
        dueDate: d.dueDate.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[platform-fee/delinquents]', e);
    return NextResponse.json(
      { error: 'Error al listar escuelas en mora' },
      { status: 500 }
    );
  }
}
