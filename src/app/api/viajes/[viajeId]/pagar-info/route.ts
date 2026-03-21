/**
 * GET /api/viajes/[viajeId]/pagar-info
 * Info pública del viaje para la página de pago (sin auth).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ viajeId: string }> }
) {
  const { viajeId } = await params;
  if (!viajeId) {
    return NextResponse.json({ message: 'viajeId requerido' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const viajeSnap = await db.collection('viajes').doc(viajeId).get();
  if (!viajeSnap.exists) {
    return NextResponse.json({ message: 'Viaje no encontrado' }, { status: 404 });
  }

  const d = viajeSnap.data()!;
  if (d.estado !== 'abierto') {
    return NextResponse.json({ message: 'Este viaje no está abierto para pagos' }, { status: 400 });
  }

  const toDate = (v: unknown) => {
    if (!v) return null;
    const t = v as { toDate?: () => Date };
    if (typeof t.toDate === 'function') return t.toDate();
    return new Date(v as string);
  };

  return NextResponse.json({
    viajeId,
    destino: d.destino,
    fechaSalida: toDate(d.fechaSalida)?.toISOString(),
    fechaRegreso: toDate(d.fechaRegreso)?.toISOString(),
    precioPorJugador: Math.round(d.precioPorJugador ?? 0),
    metodoPagoHabilitado: (d.metodoPagoHabilitado ?? ['transferencia_whatsapp', 'transferencia_app']) as string[],
    cbuClub: d.cbuClub ?? process.env.CLUB_CBU ?? '',
    aliasClub: d.aliasClub ?? process.env.CLUB_ALIAS ?? '',
    bancoClub: d.bancoClub ?? process.env.CLUB_BANCO ?? 'Santander',
  });
}
