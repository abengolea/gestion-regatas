/**
 * POST /api/entradas/abonado/iniciar-pago
 * Compra con Mercado Pago (sin cuenta Firebase): platea disponible o liberada por otro titular.
 * Si el asiento liberado es tuyo, usá /retomar (sin costo).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getMercadoPagoConnection } from "@/lib/payments/db";
import { createMercadoPagoEntradaPreference } from "@/lib/payments/mercadopago-checkout";
import type { EntradaPriceTier } from "@/lib/types/entradas";
import { requireAbonadoEntradasAuth } from "@/app/api/entradas/abonado/_auth";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";

const bodySchema = z.object({
  eventId: z.string().min(1),
  seatId: z.string().min(1),
  tier: z.enum(["socio", "general"]),
  /** Slug de URL para volver después del checkout */
  returnSlug: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireAbonadoEntradasAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { subcomisionId, socioId, numeroSocio } = auth.claims;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventId, seatId, tier, returnSlug } = parsed.data;

  try {
    const db = getAdminFirestore();
    const eventRef = db.collection("subcomisiones").doc(subcomisionId).collection("plateasEventos").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    const ev = eventSnap.data()!;
    if (ev.estado !== "venta_abierta") {
      return NextResponse.json({ error: "La venta no está abierta para este partido" }, { status: 400 });
    }

    const precioSocio = Number(ev.precioSocio ?? 0);
    const precioGeneral = Number(ev.precioGeneral ?? 0);
    const unitAmount = tier === "socio" ? precioSocio : precioGeneral;
    if (!unitAmount || unitAmount <= 0) {
      return NextResponse.json({ error: "Precio no configurado" }, { status: 400 });
    }

    const seatRef = eventRef.collection("asientos").doc(seatId);
    const seatSnap = await seatRef.get();
    const seatData = seatSnap.data() as
      | {
          estado?: string;
          titularSocioId?: string | null;
        }
      | undefined;
    const estado = seatData?.estado ?? "disponible";

    if (estado === "reservado_manual" || estado === "pagado" || estado === "abonado_fijo") {
      return NextResponse.json({ error: "Este asiento no está a la venta" }, { status: 409 });
    }

    if (estado === "liberado_temporal" && seatData?.titularSocioId === socioId) {
      return NextResponse.json(
        {
          error:
            "Este lugar era tuyo y lo liberaste. Podés volver a usarlo sin pagar con la opción «Volver a usar mi lugar».",
        },
        { status: 400 }
      );
    }

    if (!["disponible", "liberado_temporal", "reservado"].includes(estado)) {
      return NextResponse.json({ error: "Asiento no disponible" }, { status: 409 });
    }

    const conn = await getMercadoPagoConnection(db, subcomisionId);
    if (!conn?.access_token) {
      return NextResponse.json({ error: "Mercado Pago no está conectado para esta sede" }, { status: 400 });
    }

    const socioSnap = await db
      .collection("subcomisiones")
      .doc(subcomisionId)
      .collection("socios")
      .doc(socioId)
      .get();
    const s = socioSnap.data();
    const buyerDisplayName =
      [s?.apellido, s?.nombre].filter(Boolean).join(" ").trim() || `Socio ${numeroSocio}`;
    const buyerEmail = typeof s?.email === "string" ? s.email : null;

    const pendingRef = db.collection("subcomisiones").doc(subcomisionId).collection("entradasPagosPendientes").doc();
    const pendingId = pendingRef.id;
    const tierLabel: EntradaPriceTier = tier;
    const evTitulo = (ev.titulo as string) || "Partido";

    await pendingRef.set({
      eventId,
      seatIds: [seatId],
      seatId,
      tier: tierLabel,
      amount: unitAmount,
      amountPerSeat: unitAmount,
      seatCount: 1,
      currency: (ev.moneda as string) || "ARS",
      buyerUid: null,
      buyerEmail,
      buyerSocioId: socioId,
      buyerDisplayName,
      estado: "pendiente",
      createdAt: new Date(),
    });

    const backPrefix = `${BASE_URL}/entradas-abonado/${encodeURIComponent(returnSlug)}`;
    const { init_point, preference_id } = await createMercadoPagoEntradaPreference(conn.access_token, {
      subcomisionId,
      pendingId,
      eventId,
      seatId,
      seatIds: [seatId],
      amount: unitAmount,
      currency: (ev.moneda as string) || "ARS",
      title: `Platea ${seatId} — ${evTitulo}`,
      backUrls: {
        success: `${backPrefix}?pago=ok`,
        failure: `${backPrefix}?pago=error`,
        pending: `${backPrefix}?pago=pendiente`,
      },
    });

    await pendingRef.set({ preferenceId: preference_id }, { merge: true });

    const batch = db.batch();
    const reservedAt = new Date();
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
    await batch.commit();

    return NextResponse.json({ init_point, preference_id });
  } catch (e) {
    console.error("[entradas/abonado/iniciar-pago]", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
