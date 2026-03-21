/**
 * POST /api/payments/send-reminders
 * Envía recordatorios de pago masivos a morosos seleccionados con link de pago.
 */

import { NextResponse } from 'next/server';
import { sendRemindersSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getOrCreatePaymentConfig, getMercadoPagoAccessToken, getExpectedAmountForPeriod, findApprovedPayment, playerExistsInSchool } from '@/lib/payments/db';
import { createPaymentIntentWithProvider } from '@/lib/payments/provider-stub';
import { createPaymentIntent } from '@/lib/payments/db';
import { sendEmailEvent } from '@/lib/payments/email-events';
import { getSchoolById } from '@/lib/posts/server';
import { verifyIdToken } from '@/lib/auth-server';
import admin from 'firebase-admin';

const DAILY_LIMIT = 200;

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sendRemindersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolId, items } = parsed.data;
    const db = getAdminFirestore();

    // Verificar límite diario
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySnap = await db
      .collection('emailEvents')
      .where('type', '==', 'payment_reminder_manual')
      .where('schoolId', '==', schoolId)
      .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
      .get();

    const sentToday = todaySnap.size;
    const remaining = Math.max(0, DAILY_LIMIT - sentToday);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Se alcanzó el límite diario de ${DAILY_LIMIT} recordatorios. Probá mañana.` },
        { status: 429 }
      );
    }

    const toSend = items.slice(0, remaining);

    const school = await getSchoolById(schoolId);
    const schoolName = school?.name ?? 'tu escuela';
    const config = await getOrCreatePaymentConfig(db, schoolId);
    const mercadopagoAccessToken = await getMercadoPagoAccessToken(db, schoolId);

    if (!mercadopagoAccessToken) {
      return NextResponse.json(
        { error: 'Tu escuela no tiene Mercado Pago conectado. Conectalo en Administración → Pagos.' },
        { status: 400 }
      );
    }

    let sent = 0;
    let skipped = 0;
    let noEmail = 0;
    const errors: string[] = [];

    for (const item of toSend) {
      const email = (item.playerEmail ?? '').trim();
      if (!email) {
        noEmail++;
        continue;
      }

      const playerExists = await playerExistsInSchool(db, schoolId, item.playerId);
      if (!playerExists) {
        errors.push(`${item.playerName}: jugador no encontrado en esta escuela`);
        continue;
      }

      const existing = await findApprovedPayment(db, item.playerId, item.period);
      if (existing) {
        skipped++;
        continue;
      }

      const amount = await getExpectedAmountForPeriod(db, schoolId, item.playerId, item.period, config);
      if (amount <= 0) {
        errors.push(`${item.playerName}: monto no configurado para este período`);
        continue;
      }

      try {
        const { checkoutUrl } = await createPaymentIntentWithProvider(
          'mercadopago',
          { socioId: item.playerId, subcomisionId: schoolId, period: item.period, amount, currency: item.currency, mercadopagoAccessToken }
        );

        await createPaymentIntent(db, {
          playerId: item.playerId,
          schoolId,
          period: item.period,
          amount,
          currency: item.currency,
          provider: 'mercadopago',
          checkoutUrl,
        });

        const didSend = await sendEmailEvent({
          db,
          type: 'payment_reminder_manual',
          playerId: item.playerId,
          schoolId,
          period: item.period,
          to: email,
          playerName: item.playerName,
          amount,
          currency: item.currency,
          checkoutUrl: checkoutUrl ?? undefined,
          schoolName,
        });
        if (didSend) sent++;
        else skipped++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${item.playerName}: ${msg}`);
      }
    }

    return NextResponse.json({
      sent,
      skipped,
      noEmail,
      errors,
    });
  } catch (e) {
    console.error('[payments/send-reminders]', e);
    return NextResponse.json(
      { error: 'Error al enviar recordatorios' },
      { status: 500 }
    );
  }
}
