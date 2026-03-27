/**
 * POST /api/entradas/abonado/retomar
 * El abonado vuelve a tomar su platea si sigue liberada (sin cobro).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAbonadoEntradasAuth } from "@/app/api/entradas/abonado/_auth";

const bodySchema = z.object({
  eventId: z.string().min(1),
  seatId: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireAbonadoEntradasAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { subcomisionId, socioId } = auth.claims;
  const { eventId, seatId } = parsed.data;

  try {
    const db = getAdminFirestore();
    const seatRef = db
      .collection("subcomisiones")
      .doc(subcomisionId)
      .collection("plateasEventos")
      .doc(eventId)
      .collection("asientos")
      .doc(seatId);

    const snap = await seatRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Asiento no encontrado" }, { status: 404 });
    }

    const d = snap.data() as {
      estado?: string;
      titularSocioId?: string | null;
      reservaPendingId?: string | null;
    };

    if (d.titularSocioId !== socioId) {
      return NextResponse.json({ error: "Este asiento no está registrado a tu número de socio." }, { status: 403 });
    }

    if (d.estado !== "liberado_temporal") {
      return NextResponse.json(
        { error: "Solo podés retomar una platea que hayas liberado y siga en estado liberada." },
        { status: 409 }
      );
    }

    if (d.reservaPendingId) {
      return NextResponse.json(
        { error: "Hay un pago en curso sobre este asiento. Esperá unos minutos o consultá en secretaría." },
        { status: 409 }
      );
    }

    await seatRef.set(
      {
        estado: "abonado_fijo",
        liberadoEnEventoId: FieldValue.delete(),
        reservaPreferenceId: FieldValue.delete(),
        reservaPendingId: FieldValue.delete(),
        reservadoDesde: FieldValue.delete(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[entradas/abonado/retomar]", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
