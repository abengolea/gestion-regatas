/**
 * POST /api/entradas/abonado/liberar
 * Abonado indica que no usará su platea en ese partido (libera para venta).
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

    const d = snap.data() as { estado?: string; titularSocioId?: string | null };
    if (d.titularSocioId !== socioId) {
      return NextResponse.json({ error: "Este asiento no está registrado a tu número de socio." }, { status: 403 });
    }
    if (d.estado !== "abonado_fijo") {
      return NextResponse.json(
        { error: "Solo podés liberar una platea que figure como abonado fijo para este partido." },
        { status: 409 }
      );
    }

    await seatRef.set(
      {
        estado: "liberado_temporal",
        liberadoEnEventoId: eventId,
        reservaPreferenceId: FieldValue.delete(),
        reservaPendingId: FieldValue.delete(),
        reservadoDesde: FieldValue.delete(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[entradas/abonado/liberar]", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
