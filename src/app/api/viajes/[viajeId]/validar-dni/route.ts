/**
 * POST /api/viajes/[viajeId]/validar-dni
 * Valida DNI contra jugadoresDesignados. Retorna socioId si válido y no pagado.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ viajeId: string }> }
) {
  const { viajeId } = await params;
  if (!viajeId) {
    return NextResponse.json({ message: 'viajeId requerido' }, { status: 400 });
  }

  let body: { dni?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  const dni = (body.dni ?? '').trim().replace(/\D/g, '');
  if (dni.length < 7) {
    return NextResponse.json({ valido: false, message: 'DNI inválido' });
  }

  const db = getAdminFirestore();
  const viajeSnap = await db.collection('viajes').doc(viajeId).get();
  if (!viajeSnap.exists) {
    return NextResponse.json({ valido: false, message: 'Viaje no encontrado' });
  }

  const viajeData = viajeSnap.data()!;
  if (viajeData.estado !== 'abierto') {
    return NextResponse.json({ valido: false, message: 'Viaje no abierto para pagos' });
  }

  const designados = (viajeData.jugadoresDesignados ?? []) as string[];
  const subcomisionId = viajeData.subcomisionId as string;

  const sociosSnap = await db
    .collection('subcomisiones')
    .doc(subcomisionId)
    .collection('socios')
    .where('dni', '==', dni)
    .get();

  if (sociosSnap.empty) {
    return NextResponse.json({ valido: false, message: 'No encontramos un jugador con ese DNI' });
  }

  const socioDoc = sociosSnap.docs[0];
  const socioId = socioDoc.id;
  if (!designados.includes(socioId)) {
    return NextResponse.json({ valido: false, message: 'El jugador no está designado en este viaje' });
  }

  const pagoSnap = await db
    .collection('viajes')
    .doc(viajeId)
    .collection('pagos')
    .doc(socioId)
    .get();
  const pagoEstado = pagoSnap.data()?.estado ?? 'pendiente';
  if (pagoEstado === 'pagado') {
    return NextResponse.json({ valido: false, message: 'Este viaje ya está pagado para este jugador' });
  }

  const socioData = socioDoc.data();
  const nombreJugador =
    `${(socioData.nombre ?? socioData.firstName ?? '')} ${(socioData.apellido ?? socioData.lastName ?? '')}`.trim() ||
    'Jugador';

  return NextResponse.json({
    valido: true,
    socioId,
    nombreJugador,
  });
}
