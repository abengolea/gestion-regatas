/**
 * GET/POST /api/payments/webhook/mercadopago?subcomisionId=xxx
 * Recibe notificaciones IPN/Webhook de Mercado Pago (topic=payment, id=payment_id).
 * La notification_url incluye schoolId para usar el access_token de esa escuela
 * y consultar el pago en la API de MP.
 *
 * IPN envía topic e id por query. Webhooks pueden enviar type y data.id en el body.
 * Responder 200 rápido y procesar después para no agotar el timeout de MP.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  findPaymentByProviderId,
  createPayment,
  updatePlayerStatus,
  playerExistsInSchool,
  getMercadoPagoConnection,
} from '@/lib/payments/db';
import { sendEmailEvent } from '@/lib/payments/email-events';
import { applyViajeMercadoPagoApproved } from '@/lib/viajes/mercadopago-webhook';
import { applyEntradaMercadoPagoApproved } from '@/lib/entradas/mercadopago-webhook';
import { applyAbonoPublicoMercadoPagoApproved } from '@/lib/entradas/abono-publico-webhook';
import { applyAbonoPublicoPlateasMercadoPagoApproved } from '@/lib/entradas/abono-publico-plateas-webhook';
import { isAbonoPublicoEntrada } from '@/lib/entradas/abono-publico-constants';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import type admin from 'firebase-admin';

type ParsedExternalRef =
  | { kind: 'cuota'; schoolId: string; playerId: string; period: string }
  | { kind: 'entrada'; schoolId: string; pendingId: string; eventId: string; seatId: string }
  | { kind: 'entrada_multi'; schoolId: string; pendingId: string };

/**
 * external_reference:
 * - cuotas: schoolId|socioId|period
 * - una platea: schoolId|pendingId|entrada:eventId:seatId
 * - varias plateas: schoolId|pendingId|entrada-multi
 */
function parseExternalReference(ref: string): ParsedExternalRef | null {
  const parts = ref.split('|');
  if (parts.length !== 3) return null;
  const [schoolId, mid, period] = parts;
  if (!schoolId || !mid || !period) return null;
  if (period === 'entrada-multi') {
    return { kind: 'entrada_multi', schoolId, pendingId: mid };
  }
  if (period.startsWith('entrada:')) {
    const rest = period.slice('entrada:'.length);
    const colon = rest.indexOf(':');
    if (colon === -1) return null;
    const eventId = rest.slice(0, colon);
    const seatId = rest.slice(colon + 1);
    if (!eventId || !seatId) return null;
    return { kind: 'entrada', schoolId, pendingId: mid, eventId, seatId };
  }
  return { kind: 'cuota', schoolId, playerId: mid, period };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const id = url.searchParams.get('id');
  const schoolId = url.searchParams.get('schoolId');
  return processNotification({ topic, paymentId: id, schoolId });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get('schoolId');
  let topic: string | null = url.searchParams.get('topic');
  let paymentId: string | null = url.searchParams.get('id');
  try {
    const body = await request.json().catch(() => ({}));
    if (!topic) topic = body.type ?? body.topic ?? null;
    if (!paymentId) paymentId = body.data?.id ?? body.id ?? null;
  } catch {
    // body vacío o no JSON
  }
  return processNotification({ topic, paymentId, schoolId });
}

async function processNotification(params: {
  topic: string | null;
  paymentId: string | null;
  schoolId: string | null;
}) {
  const { topic, paymentId, schoolId } = params;

  // Siempre responder 200 a MP para que no reintente
  if (topic !== 'payment' || !paymentId || !schoolId) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminFirestore();

  const conn = await getMercadoPagoConnection(db, schoolId);
  if (!conn?.access_token) {
    console.warn('[webhook/mercadopago] No token for schoolId:', schoolId);
    return NextResponse.json({ ok: true });
  }

  const client = new MercadoPagoConfig({
    accessToken: conn.access_token,
    options: { timeout: 8000 },
  });
  const paymentClient = new Payment(client);

  let payment: { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string };
  try {
    const res = await paymentClient.get({ id: paymentId });
    payment = {
      status: res.status,
      external_reference: res.external_reference,
      transaction_amount: res.transaction_amount,
      currency_id: res.currency_id,
    };
  } catch (e) {
    console.error('[webhook/mercadopago] GET payment failed', paymentId, e);
    return NextResponse.json({ ok: true });
  }

  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true });
  }

  const ref = parseExternalReference(payment.external_reference ?? '');
  if (!ref) {
    console.warn('[webhook/mercadopago] Invalid external_reference:', payment.external_reference);
    return NextResponse.json({ ok: true });
  }

  if (ref.schoolId !== schoolId) {
    console.warn('[webhook/mercadopago] schoolId mismatch query vs external_reference', {
      query: schoolId,
      ref: ref.schoolId,
    });
    return NextResponse.json({ ok: true });
  }

  const amount = payment.transaction_amount ?? 0;
  const currency = payment.currency_id ?? 'ARS';

  if (ref.kind === 'entrada' || ref.kind === 'entrada_multi') {
    try {
      const pendSnap = await db
        .collection('subcomisiones')
        .doc(ref.schoolId)
        .collection('entradasPagosPendientes')
        .doc(ref.pendingId)
        .get();
      const pd = pendSnap.data() as
        | { tipo?: string; seatIds?: string[]; abonoMapEventId?: string }
        | undefined;

      const isAbonoConPlateas =
        pd?.tipo === 'abono_publico' &&
        Array.isArray(pd.seatIds) &&
        pd.seatIds.length > 0 &&
        typeof pd.abonoMapEventId === 'string' &&
        pd.abonoMapEventId.length > 0;

      if (isAbonoConPlateas) {
        await applyAbonoPublicoPlateasMercadoPagoApproved(db, {
          schoolId: ref.schoolId,
          pendingId: ref.pendingId,
          paymentId: String(paymentId),
          amount,
          currency,
        });
      } else if (ref.kind === 'entrada' && isAbonoPublicoEntrada(ref.eventId, ref.seatId)) {
        await applyAbonoPublicoMercadoPagoApproved(db, {
          schoolId: ref.schoolId,
          pendingId: ref.pendingId,
          paymentId: String(paymentId),
          amount,
          currency,
        });
      } else {
        await applyEntradaMercadoPagoApproved(db, {
          schoolId: ref.schoolId,
          pendingId: ref.pendingId,
          paymentId: String(paymentId),
          amount,
          ...(ref.kind === 'entrada'
            ? { legacyEventId: ref.eventId, legacySeatId: ref.seatId }
            : {}),
        });
      }
    } catch (e) {
      console.error('[webhook/mercadopago] entrada/abono apply failed', e);
    }
    return NextResponse.json({ ok: true });
  }

  const { playerId, period } = ref;

  if (period.startsWith('viaje-')) {
    const viajeId = period.slice('viaje-'.length);
    if (!viajeId) return NextResponse.json({ ok: true });
    try {
      await applyViajeMercadoPagoApproved(db, {
        schoolId: ref.schoolId,
        playerId,
        viajeId,
        paymentId: String(paymentId),
        amount,
      });
    } catch (e) {
      console.error('[webhook/mercadopago] viaje apply failed', e);
    }
    return NextResponse.json({ ok: true });
  }

  const playerExists = await playerExistsInSchool(db, schoolId, playerId);
  if (!playerExists) {
    console.warn('[webhook/mercadopago] Socio not in school', { schoolId, playerId });
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const idempotencyKey = `mercadopago_${paymentId}`;
  await createPayment(
    db,
    {
      socioId: playerId,
      subcomisionId: schoolId,
      period,
      amount,
      currency,
      provider: 'mercadopago',
      providerPaymentId: String(paymentId),
      status: 'approved',
      paidAt: now,
    },
    idempotencyKey
  );

  await updatePlayerStatus(db, schoolId, playerId, 'active');

  const playerRef = db.collection('subcomisiones').doc(schoolId).collection('socios').doc(playerId);
  const playerSnap = await playerRef.get();
  const socioData = playerSnap.data();
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
      console.warn('[webhook/mercadopago] Email no enviado:', emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
