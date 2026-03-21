/**
 * POST /api/webhooks/mp/viajes
 * Webhook de Mercado Pago para pagos de viajes.
 * Recibe notificaciones de MP cuando un pago cambia de estado.
 * Debe responder 200 en menos de 5 segundos.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const viajeId = url.searchParams.get('viajeId');
  const socioId = url.searchParams.get('socioId');

  if (!viajeId || !socioId) {
    return NextResponse.json({ ok: true });
  }

  let paymentId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    paymentId = body.data?.id ?? body.id ?? null;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminFirestore();
  const viajeSnap = await db.collection('viajes').doc(viajeId).get();
  if (!viajeSnap.exists) {
    return NextResponse.json({ ok: true });
  }

  const viajeData = viajeSnap.data()!;
  const subcomisionId = viajeData.subcomisionId as string;

  const { getMercadoPagoConnection } = await import('@/lib/payments/db');
  const conn = await getMercadoPagoConnection(db, subcomisionId);
  if (!conn?.access_token) {
    return NextResponse.json({ ok: true });
  }

  const client = new MercadoPagoConfig({
    accessToken: conn.access_token,
    options: { timeout: 5000 },
  });
  const paymentClient = new Payment(client);

  let payment: { status?: string; external_reference?: string };
  try {
    const res = await paymentClient.get({ id: paymentId });
    payment = {
      status: res.status,
      external_reference: res.external_reference ?? undefined,
    };
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = await import('firebase-admin');
  const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);

  if (payment.status === 'approved') {
    await pagoRef.set(
      {
        estado: 'pagado',
        mpPaymentId: String(paymentId),
        confirmadoEn: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
  } else if (payment.status === 'pending') {
    await pagoRef.set(
      { estado: 'parcial', updatedAt: admin.firestore.Timestamp.now() },
      { merge: true }
    );
  } else if (payment.status === 'rejected') {
    await pagoRef.set(
      { estado: 'rechazado', updatedAt: admin.firestore.Timestamp.now() },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true });
}
