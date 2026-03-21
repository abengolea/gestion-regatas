/**
 * POST /api/pagos/aprobar
 * Admin aprueba pago en revisión. Notifica al padre vía NotificasHub.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import { NotificasHubClient } from '@/lib/whatsapp/NotificasHubClient';

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
    const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
    const pagoSnap = await pagoRef.get();
    if (!pagoSnap.exists) {
      return NextResponse.json({ message: 'Pago no encontrado' }, { status: 404 });
    }

    const pagoData = pagoSnap.data()!;
    if (pagoData.estado !== 'en_revision') {
      return NextResponse.json(
        { message: 'Solo se pueden aprobar pagos en revisión' },
        { status: 400 }
      );
    }

    const admin = await import('firebase-admin');
    await pagoRef.update({
      estado: 'pagado',
      aprobadoPor: auth.uid,
      confirmadoEn: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    const viajeData = viajeSnap.data()!;
    const destino = viajeData.destino as string;

    const socioSnap = await db
      .collection('subcomisiones')
      .doc(viajeData.subcomisionId as string)
      .collection('socios')
      .doc(socioId)
      .get();
    const socioData = socioSnap.data() ?? {};
    const nombreJugador =
      `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
      socioId;
    const celular = pagoData.celularPagador ?? socioData.tutorContact?.phone ?? socioData.telefono;

    if (celular) {
      try {
        await NotificasHubClient.sendText(
          celular,
          `✓ Pago confirmado para ${nombreJugador} - Viaje a ${destino}. ¡Ya está anotado!`
        );
      } catch (e) {
        console.warn('[pagos/aprobar] NotificasHub send:', e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[pagos/aprobar]', e);
    return NextResponse.json(
      { message: (e as Error).message },
      { status: 500 }
    );
  }
}
