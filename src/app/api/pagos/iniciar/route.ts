/**
 * POST /api/pagos/iniciar
 * Inicia un pago según el método elegido.
 * → PaymentRegistry.get(método).iniciarPago()
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { PaymentRegistry } from '@/lib/payments/PaymentRegistry';
import { verifyIdToken } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const auth = await verifyIdToken(authHeader);
    if (!auth?.uid) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { viajeId, socioId, metodoPago } = body as {
      viajeId?: string;
      socioId?: string;
      metodoPago?: string;
    };

    if (!viajeId || !socioId || !metodoPago) {
      return NextResponse.json(
        { message: 'viajeId, socioId y metodoPago requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    if (!viajeSnap.exists) {
      return NextResponse.json({ message: 'Viaje no encontrado' }, { status: 404 });
    }

    const viajeData = viajeSnap.data()!;
    const habilitados = (viajeData.metodoPagoHabilitado ?? []) as string[];
    if (habilitados.length && !habilitados.includes(metodoPago)) {
      return NextResponse.json(
        { message: `Método ${metodoPago} no disponible para este viaje` },
        { status: 400 }
      );
    }

    const sociosSnap = await db
      .collection('subcomisiones')
      .doc(viajeData.subcomisionId as string)
      .collection('socios')
      .doc(socioId)
      .get();

    if (!sociosSnap.exists) {
      return NextResponse.json({ message: 'Socio no encontrado' }, { status: 404 });
    }

    const socioData = sociosSnap.data()!;
    const nombreJugador =
      `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
      socioId;
    const tutorPhone = socioData.tutorContact?.phone ?? socioData.telefono ?? '';
    const tutorName = socioData.tutorContact?.name ?? nombreJugador;
    const destino = viajeData.destino as string;
    const monto = Math.round((viajeData.precioPorJugador as number) ?? 0);
    const concepto = `Viaje ${destino} — ${nombreJugador}`;

    const provider = PaymentRegistry.get(metodoPago);
    const result = await provider.iniciarPago({
      viajeId,
      socioId,
      monto,
      concepto,
      pagadorNombre: tutorName,
      pagadorCelular: tutorPhone,
      pagadorEmail: socioData.email,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error('[pagos/iniciar]', e);
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
