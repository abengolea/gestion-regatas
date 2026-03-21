/**
 * GET /api/viajes/pagos-en-revision
 * Lista pagos en estado 'en_revision' de la subcomisión.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const auth = await verifyIdToken(authHeader);
    if (!auth?.uid) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const subcomisionId = url.searchParams.get('subcomisionId');
    if (!subcomisionId) {
      return NextResponse.json(
        { message: 'subcomisionId requerido' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const viajesSnap = await db
      .collection('viajes')
      .where('subcomisionId', '==', subcomisionId)
      .where('estado', '==', 'abierto')
      .get();

    const pagos: Array<{
      viajeId: string;
      socioId: string;
      viajeDestino: string;
      nombreJugador: string;
      monto: number;
      comprobanteUrl: string;
      comprobanteFuente: 'whatsapp' | 'app';
    }> = [];

    for (const viajeDoc of viajesSnap.docs) {
      const viajeData = viajeDoc.data();
      const pagosSnap = await viajeDoc.ref
        .collection('pagos')
        .where('estado', '==', 'en_revision')
        .get();

      for (const pagoDoc of pagosSnap.docs) {
        const pagoData = pagoDoc.data();
        const socioId = pagoData.socioId ?? pagoDoc.id;
        let socioSnap = await db
          .collection('subcomisiones')
          .doc(subcomisionId)
          .collection('socios')
          .doc(socioId)
          .get();
        if (!socioSnap.exists) {
          socioSnap = await db
            .collection('subcomisiones')
            .doc(subcomisionId)
            .collection('players')
            .doc(socioId)
            .get();
        }
        const socioData = socioSnap.data() ?? {};
        const nombreJugador =
          `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
          socioId;

        pagos.push({
          viajeId: viajeDoc.id,
          socioId,
          viajeDestino: viajeData.destino ?? '',
          nombreJugador,
          monto: Math.round(pagoData.monto ?? 0),
          comprobanteUrl: pagoData.comprobanteUrl ?? pagoData.comprobante ?? '',
          comprobanteFuente: pagoData.comprobanteFuente ?? 'app',
        });
      }
    }

    pagos.sort((a, b) => b.viajeId.localeCompare(a.viajeId));

    return NextResponse.json({ pagos });
  } catch (e) {
    console.error('[pagos-en-revision]', e);
    return NextResponse.json(
      { message: (e as Error).message },
      { status: 500 }
    );
  }
}
