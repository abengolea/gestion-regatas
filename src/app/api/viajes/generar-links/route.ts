/**
 * POST /api/viajes/generar-links
 * Genera links de pago de Mercado Pago para los socios designados.
 * Llama a la Cloud Function generarLinksPago o implementa la lógica aquí.
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
    const { viajeId, socioIds } = body as { viajeId?: string; socioIds?: string[] };

    if (!viajeId || !Array.isArray(socioIds) || socioIds.length === 0) {
      return NextResponse.json(
        { message: 'viajeId y socioIds (array) requeridos' },
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
        { message: 'La subcomisión no tiene Mercado Pago conectado. Configurá la conexión en Pagos.' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/webhooks/mp/viajes`;
    const precio = Math.round((viajeData.precioPorJugador as number) ?? 0);

    const { MercadoPagoConfig, Preference } = await import('mercadopago');
    const client = new MercadoPagoConfig({
      accessToken: conn.access_token,
      options: { timeout: 8000 },
    });
    const preference = new Preference(client);

    const sociosSnap = await db
      .collection('subcomisiones')
      .doc(subcomisionId)
      .collection('socios')
      .get();

    const sociosMap = new Map<string, { nombre: string; email?: string }>();
    sociosSnap.docs.forEach((d) => {
      const data = d.data();
      sociosMap.set(d.id, {
        nombre: `${(data.nombre ?? data.firstName ?? '')} ${(data.apellido ?? data.lastName ?? '')}`.trim(),
        email: data.email,
      });
    });

    const admin = await import('firebase-admin');
    const batch = db.batch();

    for (const socioId of socioIds) {
      const socioInfo = sociosMap.get(socioId);
      const nombreJugador = socioInfo?.nombre ?? socioId;
      const destino = (viajeData.destino as string) ?? 'Viaje';

      const prefData = {
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
      };

      const created = await preference.create({ body: prefData });
      const initPoint = created.init_point ?? created.sandbox_init_point ?? '';

      const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
      batch.set(pagoRef, {
        viajeId,
        socioId,
        monto: precio,
        metodoPago: 'mp',
        estado: 'pendiente',
        mpPreferenceId: created.id,
        initPoint: initPoint,
        updatedAt: admin.firestore.Timestamp.now(),
      }, { merge: true });

      // TODO: Enviar email/WhatsApp con initPoint al padre/madre (notificarPadreMadre)
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[generar-links]', e);
    return NextResponse.json(
      { message: (e as Error).message },
      { status: 500 }
    );
  }
}
