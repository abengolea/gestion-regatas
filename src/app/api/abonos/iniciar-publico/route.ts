/**

 * POST /api/abonos/iniciar-publico

 * Checkout Pro Mercado Pago para abono público con elección de platea(s).

 */



import { NextResponse } from "next/server";

import { z } from "zod";

import { getAdminFirestore } from "@/lib/firebase-admin";

import { getMercadoPagoConnection } from "@/lib/payments/db";

import { createMercadoPagoEntradaPreference } from "@/lib/payments/mercadopago-checkout";

import { resolveVentaAbonoPublica } from "@/lib/entradas/resolve-venta-abono-publica";

import { validateAbonoSeatsAvailableAllEvents } from "@/lib/entradas/validate-abono-seats-all-events";



const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";



const bodySchema = z.object({

  slug: z.string().min(2),

  tier: z.enum(["socio", "general"]),

  email: z.string().email(),

  nombreApellido: z.string().min(3).max(120),

  telefono: z.string().max(40).optional(),

  dni: z.string().max(20).optional(),

  /** Plateas elegidas (ids del layout, ej. rio-1). Deben estar libres en todos los partidos. */

  seatIds: z.array(z.string().min(1)).min(1).max(30),

});



function uniqueSeatIds(ids: string[]): string[] {

  return [...new Set(ids.map((s) => s.trim()).filter(Boolean))];

}



export async function POST(request: Request) {

  try {

    const json = await request.json();

    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {

      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

    }



    const { slug, tier, email, nombreApellido, telefono, dni } = parsed.data;

    const seatIds = uniqueSeatIds(parsed.data.seatIds);

    if (seatIds.length === 0) {

      return NextResponse.json({ error: "Elegí al menos una platea" }, { status: 400 });

    }



    const db = getAdminFirestore();

    const resolved = await resolveVentaAbonoPublica(db, slug);

    if (!resolved) {

      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    }



    const { subcomisionId, subcomision: data } = resolved;

    const v = data.ventaAbonoPublica;

    const mapId = v.plateasEventoMapaId?.trim();

    if (!mapId) {

      return NextResponse.json(

        {

          error: "Falta configurar el plano de abono",

          hint: "En el admin (Abono web) cargá el ID del documento en plateasEventos que sirve para elegir plateas.",

        },

        { status: 400 }

      );

    }



    const mapEventRef = db.collection("subcomisiones").doc(subcomisionId).collection("plateasEventos").doc(mapId);

    const mapEventSnap = await mapEventRef.get();

    if (!mapEventSnap.exists) {

      return NextResponse.json({ error: `No existe el partido/plano «${mapId}» en plateasEventos.` }, { status: 400 });

    }



    const val = await validateAbonoSeatsAvailableAllEvents(db, subcomisionId, seatIds);

    if (!val.ok) {

      return NextResponse.json({ error: val.error, eventId: val.eventId, seatId: val.seatId }, { status: 409 });

    }



    const precioSocio = Number(v.precioSocio);

    const precioGeneral = Number(v.precioGeneral);

    const unitAmount = tier === "socio" ? precioSocio : precioGeneral;

    if (!unitAmount || unitAmount <= 0) {

      return NextResponse.json({ error: "Precio no configurado" }, { status: 400 });

    }



    const totalAmount = Math.round(unitAmount * seatIds.length * 100) / 100;



    const conn = await getMercadoPagoConnection(db, subcomisionId);

    if (!conn?.access_token) {

      return NextResponse.json(

        { error: "Mercado Pago no está conectado para esta subcomisión" },

        { status: 400 }

      );

    }



    const pendingRef = db.collection("subcomisiones").doc(subcomisionId).collection("entradasPagosPendientes").doc();

    const pendingId = pendingRef.id;

    const moneda = v.moneda || "ARS";



    await pendingRef.set({

      tipo: "abono_publico",

      abonoMapEventId: mapId,

      seatIds,

      eventId: mapId,

      tier,

      amount: totalAmount,

      amountPerSeat: unitAmount,

      seatCount: seatIds.length,

      currency: moneda,

      buyerUid: null,

      buyerEmail: email,

      buyerDisplayName: nombreApellido.trim(),

      buyerTelefono: telefono ?? null,

      buyerDni: dni ?? null,

      publicSlug: slug,

      estado: "pendiente",

      createdAt: new Date(),

    });



    const tierLabel = tier === "socio" ? "Socio" : "No socio";

    const tituloPref =

      seatIds.length === 1

        ? `${v.titulo} — ${tierLabel} — ${seatIds[0]}`

        : `${v.titulo} — ${tierLabel} — ${seatIds.length} plateas`;



    const backBase = `${BASE_URL}/abonos-plateas/${encodeURIComponent(slug)}`;

    const { init_point, preference_id } = await createMercadoPagoEntradaPreference(conn.access_token, {

      subcomisionId,

      pendingId,

      eventId: mapId,

      seatIds,

      amount: totalAmount,

      currency: moneda,

      title: tituloPref,

      forceMultiExternalRef: true,

      backUrls: {

        success: `${backBase}?pago=ok`,

        failure: `${backBase}?pago=error`,

        pending: `${backBase}?pago=pendiente`,

      },

    });



    await pendingRef.set({ preferenceId: preference_id }, { merge: true });



    const batch = db.batch();

    const reservedAt = new Date();

    for (const seatId of seatIds) {

      const seatRef = mapEventRef.collection("asientos").doc(seatId);

      batch.set(

        seatRef,

        {

          estado: "reservado",

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

    console.error("[abonos/iniciar-publico]", e);

    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });

  }

}
