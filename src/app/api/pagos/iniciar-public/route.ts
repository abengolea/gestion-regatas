/**
 * POST /api/pagos/iniciar-public
 * Inicia un pago desde la página pública (sin auth).
 * Usado cuando el padre elige "Mandar comprobante por WhatsApp" — crea el doc pendiente
 * para que el bot pueda asociar la imagen cuando llegue.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { PaymentRegistry } from '@/lib/payments/PaymentRegistry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { viajeId, socioId, metodoPago } = body as {
      viajeId?: string;
      socioId?: string;
      metodoPago?: string;
    };

    if (!viajeId || !socioId || !metodoPago) {
      return NextResponse.json(
        { success: false, message: 'viajeId, socioId y metodoPago requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    if (!viajeSnap.exists) {
      return NextResponse.json({ success: false, message: 'Viaje no encontrado' }, { status: 404 });
    }

    const viajeData = viajeSnap.data()!;
    if (viajeData.estado !== 'abierto') {
      return NextResponse.json(
        { success: false, message: 'Este viaje no está abierto para pagos' },
        { status: 400 }
      );
    }

    const designados = (viajeData.jugadoresDesignados ?? []) as string[];
    if (!designados.includes(socioId)) {
      return NextResponse.json(
        { success: false, message: 'El jugador no está designado en este viaje' },
        { status: 400 }
      );
    }

    const habilitados = (viajeData.metodoPagoHabilitado ?? []) as string[];
    if (habilitados.length && !habilitados.includes(metodoPago)) {
      return NextResponse.json(
        { success: false, message: `Método ${metodoPago} no disponible para este viaje` },
        { status: 400 }
      );
    }

    const pagoSnap = await db
      .collection('viajes')
      .doc(viajeId)
      .collection('pagos')
      .doc(socioId)
      .get();
    const pagoEstado = pagoSnap.data()?.estado ?? 'pendiente';
    if (pagoEstado === 'pagado') {
      return NextResponse.json(
        { success: false, message: 'Este viaje ya está pagado para este jugador' },
        { status: 400 }
      );
    }

    const socioSnap = await db
      .collection('subcomisiones')
      .doc(viajeData.subcomisionId as string)
      .collection('socios')
      .doc(socioId)
      .get();
    if (!socioSnap.exists) {
      return NextResponse.json({ success: false, message: 'Socio no encontrado' }, { status: 404 });
    }

    const socioData = socioSnap.data()!;
    const nombreJugador =
      `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
      socioId;
    const tutorPhone = socioData.tutorContact?.phone ?? socioData.telefono ?? socioData.celularPadre ?? '';
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
    console.error('[pagos/iniciar-public]', e);
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
