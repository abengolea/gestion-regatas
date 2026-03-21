/**
 * POST /api/payments/update
 * Edita el período de un pago (inscripción ↔ cuota mensual). Solo admin de escuela.
 */

import { NextResponse } from 'next/server';
import { updatePaymentPeriodSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getPaymentById, updatePaymentPeriod } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updatePaymentPeriodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const schoolId = parsed.data.schoolId ?? (parsed.data as { subcomisionId?: string }).subcomisionId;
    const { paymentId, newPeriod } = parsed.data;
    const db = getAdminFirestore();

    // Solo admin de subcomisión o gerente del club puede editar pagos (NO encargado_deportivo)
    const schoolUserSnap = await db.doc(`subcomisiones/${schoolId}/users/${auth.uid}`).get();
    const platformUserSnap = await db.doc(`platformUsers/${auth.uid}`).get();
    const platformData = platformUserSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSubcomisionAdmin =
      schoolUserSnap.exists &&
      (schoolUserSnap.data() as { role?: string })?.role === 'admin_subcomision';
    const isSuperAdmin =
      (platformData?.gerente_club ?? platformData?.super_admin) === true || auth.email === 'abengolea1@gmail.com';

    if (!isSubcomisionAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador de la escuela puede editar pagos' },
        { status: 403 }
      );
    }

    const payment = await getPaymentById(db, paymentId);
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }
    if (payment.subcomisionId !== schoolId && payment.schoolId !== schoolId) {
      return NextResponse.json({ error: 'El pago no pertenece a esta escuela' }, { status: 400 });
    }

    const updated = await updatePaymentPeriod(db, paymentId, schoolId, newPeriod);
    if (!updated) {
      return NextResponse.json(
        { error: 'No se pudo actualizar. Verificá que no exista ya un pago para ese jugador y período.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated.id,
        period: updated.period,
        paymentType: updated.paymentType,
      },
    });
  } catch (e) {
    console.error('[payments/update]', e);
    return NextResponse.json(
      { error: 'Error al actualizar el pago' },
      { status: 500 }
    );
  }
}
