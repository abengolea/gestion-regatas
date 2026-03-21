/**
 * POST /api/payments/manual
 * Marca un pago como aprobado manualmente (admin de escuela).
 */

import { NextResponse } from 'next/server';
import { markManualPaymentSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  createPayment,
  findApprovedPayment,
  updatePlayerStatus,
  playerExistsInSchool,
} from '@/lib/payments/db';
import { sendEmailEvent } from '@/lib/payments/email-events';
import { verifyIdToken } from '@/lib/auth-server';
import type admin from 'firebase-admin';

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = markManualPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { playerId, schoolId, period, amount, currency } = parsed.data;
    const db = getAdminFirestore();

    // Regla: solo crear pago si el socio existe en esta subcomisión
    const playerExists = await playerExistsInSchool(db, schoolId, playerId);
    if (!playerExists) {
      return NextResponse.json(
        { error: 'El jugador no existe en esta escuela. Verificá que el jugador pertenezca a la escuela seleccionada.' },
        { status: 400 }
      );
    }

    const { REGISTRATION_PERIOD } = await import('@/lib/payments/constants');
    const isRegistration = period === REGISTRATION_PERIOD;
    const existing = await findApprovedPayment(db, playerId, period);
    if (existing) {
      return NextResponse.json(
        { error: isRegistration ? 'Ya existe un pago aprobado de inscripción para este jugador' : 'Ya existe un pago aprobado para este jugador y período' },
        { status: 409 }
      );
    }

    // Nombre del admin/encargado_deportivo que carga el pago (quien cobró) desde subcomisiones/{schoolId}/users
    let collectedByDisplayName = auth.email ?? 'Usuario';
    const schoolUserRef = db
      .collection('subcomisiones')
      .doc(schoolId)
      .collection('users')
      .doc(auth.uid);
    const schoolUserSnap = await schoolUserRef.get();
    if (schoolUserSnap.exists) {
      const displayName = (schoolUserSnap.data() as { displayName?: string })?.displayName?.trim();
      if (displayName) collectedByDisplayName = displayName;
    }

    const now = new Date();
    const payment = await createPayment(db, {
      socioId: playerId,
      subcomisionId: schoolId,
      period,
      amount,
      currency,
      provider: 'manual',
      status: 'approved',
      paidAt: now,
      metadata: {
        collectedByUid: auth.uid,
        collectedByEmail: auth.email ?? '',
        collectedByDisplayName,
      },
    });

    // Reactivar si estaba suspendido
    await updatePlayerStatus(db, schoolId, playerId, 'active');

    // Enviar email de recibo
    const socioRef = db
      .collection('subcomisiones')
      .doc(schoolId)
      .collection('socios')
      .doc(playerId);
    const socioSnap = await socioRef.get();
    const socioData = socioSnap.data();
    const playerName = socioData
      ? `${(socioData.firstName ?? socioData.nombre ?? '')} ${(socioData.lastName ?? socioData.apellido ?? '')}`.trim()
      : 'Socio';
    const toEmail = socioData?.email ?? (socioData as { email?: string })?.email;
    if (toEmail) {
      await sendEmailEvent({
        db: db as admin.firestore.Firestore,
        type: 'payment_receipt',
        playerId,
        schoolId,
        period,
        to: toEmail,
        playerName,
        amount,
        currency,
        paidAt: now,
      });
    }

    return NextResponse.json({
      paymentId: payment.id,
      status: payment.status,
      paidAt: payment.paidAt,
    });
  } catch (e) {
    console.error('[payments/manual]', e);
    return NextResponse.json(
      { error: 'Error al registrar pago manual' },
      { status: 500 }
    );
  }
}
