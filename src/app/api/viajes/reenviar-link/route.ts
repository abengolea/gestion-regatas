/**
 * POST /api/viajes/reenviar-link
 * Reenvía el link de pago a un socio (crea nueva preferencia MP).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getMercadoPagoConnection } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const auth = await verifyIdToken(authHeader);
    if (!auth?.uid) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { viajeId, socioId } = body as { viajeId?: string; socioId?: string };

    if (!viajeId || !socioId) {
      return NextResponse.json(
        { message: 'viajeId y socioId requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    if (!viajeSnap.exists) {
      return NextResponse.json({ message: 'Viaje no encontrado' }, { status: 404 });
    }

    const viajeData = viajeSnap.data()!;
    const subcomisionId = viajeData.subcomisionId as string;

    const conn = await getMercadoPagoConnection(db, subcomisionId);
    if (!conn?.access_token) {
      return NextResponse.json(
        { message: 'Mercado Pago no conectado para esta subcomisión' },
        { status: 400 }
      );
    }

    const socioSnap = await db
      .collection('subcomisiones')
      .doc(subcomisionId)
      .collection('socios')
      .doc(socioId)
      .get();

    const socioData = socioSnap.data() ?? {};
    const nombreJugador =
      `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
      socioId;
    const destino = (viajeData.destino as string) ?? 'Viaje';
    const precio = Math.round((viajeData.precioPorJugador as number) ?? 0);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/webhooks/mp/viajes`;

    const { MercadoPagoConfig, Preference } = await import('mercadopago');
    const client = new MercadoPagoConfig({
      accessToken: conn.access_token,
      options: { timeout: 8000 },
    });
    const preference = new Preference(client);

    const created = await preference.create({
      body: {
        items: [
          {
            id: `viaje-${viajeId}-${socioId}`,
            title: `Viaje ${destino} — ${nombreJugador}`,
            unit_price: precio,
            quantity: 1,
            currency_id: 'ARS',
          },
        ],
        external_reference: `viaje_${viajeId}_${socioId}`,
        notification_url: `${webhookUrl}?viajeId=${viajeId}&socioId=${socioId}`,
        back_urls: {
          success: `${baseUrl}/dashboard/payments?viaje=${viajeId}`,
          failure: `${baseUrl}/dashboard/payments?viaje=${viajeId}&error=1`,
          pending: `${baseUrl}/dashboard/payments?viaje=${viajeId}&pending=1`,
        },
        auto_return: 'approved' as const,
      },
    });

    const initPoint = created.init_point ?? created.sandbox_init_point ?? '';

    const admin = await import('firebase-admin');
    await db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId).set(
      {
        mpPreferenceId: created.id,
        initPoint,
        estado: 'pendiente',
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, initPoint });
  } catch (e) {
    console.error('[reenviar-link]', e);
    return NextResponse.json(
      { message: (e as Error).message },
      { status: 500 }
    );
  }
}
