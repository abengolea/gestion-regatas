/**
 * POST /api/entradas/iniciar-pago
 * Crea preferencia Mercado Pago para una o varias plateas del partido (un solo checkout).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import { getMercadoPagoConnection } from '@/lib/payments/db';
import { createMercadoPagoEntradaPreference } from '@/lib/payments/mercadopago-checkout';
import type { EntradaPriceTier } from '@/lib/types/entradas';

const bodySchema = z
  .object({
    subcomisionId: z.string().min(1),
    eventId: z.string().min(1),
    /** Nuevo: varios asientos en un pago */
    seatIds: z.array(z.string().min(1)).min(1).max(40).optional(),
    /** Legacy: un solo id */
    seatId: z.string().min(1).optional(),
    tier: z.enum(['socio', 'general']),
    buyerSocioId: z.string().optional(),
  })
  .refine((d) => (d.seatIds != null && d.seatIds.length > 0) || !!d.seatId, {
    message: 'Enviá seatIds (array) o seatId',
  });

function uniqueSeatIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const auth = await verifyIdToken(authHeader);
    if (!auth?.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const { subcomisionId, eventId, tier, buyerSocioId } = parsed.data;
    const seatIds = uniqueSeatIds(
      parsed.data.seatIds?.length ? parsed.data.seatIds : parsed.data.seatId ? [parsed.data.seatId] : []
    );
    if (seatIds.length === 0) {
      return NextResponse.json({ error: 'Sin asientos' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const eventRef = db.collection('subcomisiones').doc(subcomisionId).collection('plateasEventos').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    }

    const ev = eventSnap.data()!;
    if (ev.estado !== 'venta_abierta') {
      return NextResponse.json({ error: 'La venta no está abierta para este partido' }, { status: 400 });
    }

    const precioSocio = Number(ev.precioSocio ?? 0);
    const precioGeneral = Number(ev.precioGeneral ?? 0);
    const unitAmount = tier === 'socio' ? precioSocio : precioGeneral;
    if (!unitAmount || unitAmount <= 0) {
      return NextResponse.json({ error: 'Precio no configurado' }, { status: 400 });
    }

    const totalAmount = Math.round(unitAmount * seatIds.length * 100) / 100;

    for (const seatId of seatIds) {
      const seatRef = eventRef.collection('asientos').doc(seatId);
      const seatSnap = await seatRef.get();
      const seatData = seatSnap.data() as { estado?: string } | undefined;
      const estado = seatData?.estado ?? 'disponible';
      if (estado === 'reservado_manual' || estado === 'pagado' || estado === 'abonado_fijo') {
        return NextResponse.json({ error: `Asiento no disponible (${seatId})` }, { status: 409 });
      }
      if (!['disponible', 'liberado_temporal', 'reservado'].includes(estado)) {
        return NextResponse.json({ error: `Asiento no disponible (${seatId})` }, { status: 409 });
      }
    }

    const conn = await getMercadoPagoConnection(db, subcomisionId);
    if (!conn?.access_token) {
      return NextResponse.json(
        { error: 'Mercado Pago no está conectado para esta subcomisión' },
        { status: 400 }
      );
    }

    const pendingRef = db.collection('subcomisiones').doc(subcomisionId).collection('entradasPagosPendientes').doc();
    const pendingId = pendingRef.id;
    const buyerDisplayName = auth.displayName?.trim() || auth.email || 'Comprador';
    const tierLabel: EntradaPriceTier = tier;
    const evTitulo = (ev.titulo as string) || 'Partido';

    await pendingRef.set({
      eventId,
      seatIds,
      ...(seatIds.length === 1 ? { seatId: seatIds[0] } : {}),
      tier: tierLabel,
      amount: totalAmount,
      amountPerSeat: unitAmount,
      seatCount: seatIds.length,
      currency: (ev.moneda as string) || 'ARS',
      buyerUid: auth.uid,
      buyerEmail: auth.email ?? null,
      buyerSocioId: buyerSocioId ?? null,
      buyerDisplayName,
      estado: 'pendiente',
      createdAt: new Date(),
    });

    const tituloPref =
      seatIds.length === 1
        ? `Platea ${seatIds[0]} — ${evTitulo}`
        : `${seatIds.length} plateas — ${evTitulo}`;

    const { init_point, preference_id } = await createMercadoPagoEntradaPreference(conn.access_token, {
      subcomisionId,
      pendingId,
      eventId,
      seatIds,
      seatId: seatIds.length === 1 ? seatIds[0] : undefined,
      amount: seatIds.length === 1 ? unitAmount : totalAmount,
      currency: (ev.moneda as string) || 'ARS',
      title: tituloPref,
    });

    await pendingRef.set({ preferenceId: preference_id }, { merge: true });

    const batch = db.batch();
    const reservedAt = new Date();
    for (const seatId of seatIds) {
      const seatRef = eventRef.collection('asientos').doc(seatId);
      batch.set(
        seatRef,
        {
          estado: 'reservado',
          reservadoDesde: reservedAt,
          reservaPreferenceId: preference_id,
          reservaPendingId: pendingId,
        },
        { merge: true }
      );
    }
    await batch.commit();

    return NextResponse.json({ init_point, preference_id });
  } catch (e) {
    console.error('[entradas/iniciar-pago]', e);
    return NextResponse.json({ error: 'No se pudo iniciar el pago' }, { status: 500 });
  }
}
