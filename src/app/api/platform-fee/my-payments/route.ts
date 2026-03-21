/**
 * GET /api/platform-fee/my-payments?subcomisionId=xxx
 * Lista pagos de mensualidad de la escuela a la plataforma (para admin/encargado_deportivo de la escuela).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { listClubFeePayments } from '@/lib/payments/platform-fee';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requerido' }, { status: 400 });
    }

    const db = getAdminFirestore();

    const platformSnap = await db.collection('platformUsers').doc(auth.uid).get();
    const platformData = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSuperAdmin = (platformData?.gerente_club ?? platformData?.super_admin) === true;
    const userInSchool = await db.collection('subcomisiones').doc(schoolId).collection('users').doc(auth.uid).get();
    const userData = userInSchool.data() as { role?: string } | undefined;
    const isSubcomisionAdmin = userData?.role === 'admin_subcomision';
    if (!isSuperAdmin && (!userInSchool.exists || !isSubcomisionAdmin)) {
      return NextResponse.json({ error: 'Solo el administrador de la escuela puede ver el historial de mensualidades' }, { status: 403 });
    }

    const payments = await listClubFeePayments(db, { schoolId, limit: 100 });

    return NextResponse.json({
      payments: payments.map((p) => ({
        ...p,
        paidAt: p.paidAt?.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[platform-fee/my-payments]', e);
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    );
  }
}
