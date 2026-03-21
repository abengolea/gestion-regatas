/**
 * POST /api/payments/webhook
 * Webhook que recibe notificaciones de pago de MercadoPago/DLocal.
 *
 * TODO: Validar firma del payload según documentación de cada proveedor.
 * TODO: MercadoPago: x-signature, x-request-id
 * TODO: DLocal: validación de firma
 *
 * STUB: Acepta payload con provider, providerPaymentId, status para simular aprobación.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  findPaymentByProviderId,
  createPayment,
  updatePlayerStatus,
  playerExistsInSchool,
} from '@/lib/payments/db';
import { sendEmailEvent } from '@/lib/payments/email-events';
import type admin from 'firebase-admin';

const WebhookPayloadSchema = {
  provider: (v: unknown) => ['mercadopago', 'dlocal'].includes(v as string),
  providerPaymentId: (v: unknown) => typeof v === 'string' && v.length > 0,
  status: (v: unknown) => v === 'approved',
  playerId: (v: unknown) => typeof v === 'string',
  schoolId: (v: unknown) => typeof v === 'string',
  socioId: (v: unknown) => typeof v === 'string',
  subcomisionId: (v: unknown) => typeof v === 'string',
  period: (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v as string),
  amount: (v: unknown) => typeof v === 'number' && v > 0,
  currency: (v: unknown) => typeof v === 'string',
};

export async function POST(request: Request) {
  try {
    // TODO: Validar firma del webhook según proveedor antes de procesar
    // const signature = request.headers.get('x-signature') ?? request.headers.get('x-request-id');
    // if (!validateWebhookSignature(signature, body)) return 401;

    const body = await request.json();

    if (
      !WebhookPayloadSchema.provider(body.provider) ||
      !WebhookPayloadSchema.providerPaymentId(body.providerPaymentId) ||
      !WebhookPayloadSchema.status(body.status)
    ) {
      return NextResponse.json(
        { error: 'Payload inválido o status no es approved' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // Idempotencia: si ya existe pago aprobado con este providerPaymentId, no duplicar
    const existing = await findPaymentByProviderId(
      db,
      body.provider,
      body.providerPaymentId
    );
    if (existing && existing.status === 'approved') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    const playerId = body.playerId ?? body.socioId;
    const schoolId = body.schoolId ?? body.subcomisionId;
    const { period, amount, currency } = body;
    if (
      !WebhookPayloadSchema.playerId(playerId) ||
      !WebhookPayloadSchema.schoolId(schoolId) ||
      !WebhookPayloadSchema.period(period) ||
      !WebhookPayloadSchema.amount(amount) ||
      !WebhookPayloadSchema.currency(currency)
    ) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: playerId, schoolId, period, amount, currency' },
        { status: 400 }
      );
    }

    // Regla: solo crear pago si el jugador existe en esa escuela (playerId = ID del doc en subcomisiones/{schoolId}/socios)
    const playerExists = await playerExistsInSchool(db, schoolId, playerId);
    if (!playerExists) {
      return NextResponse.json(
        {
          error:
            'El jugador no existe en esta escuela. El playerId debe ser el ID del documento del jugador en la escuela (schools/{schoolId}/players/{playerId}).',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    await createPayment(db, {
      socioId: playerId,
      subcomisionId: schoolId,
      period,
      amount,
      currency,
      provider: body.provider,
      providerPaymentId: body.providerPaymentId,
      status: 'approved',
      paidAt: now,
    });

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
      try {
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
      } catch (emailErr) {
        console.warn('[payments/webhook] Email no enviado:', emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[payments/webhook]', e);
    return NextResponse.json(
      {
        error: 'Error al procesar webhook',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
