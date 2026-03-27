/**
 * GET /api/abonos/plano-publico?slug=xxx
 * Plano de asientos del evento configurado para venta de abono (solo estados públicos).
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveVentaAbonoPublica } from "@/lib/entradas/resolve-venta-abono-publica";
import { getBasquetPlateasDemoLayout } from "@/lib/entradas/basquet-plateas-layout";
import type { PlateaSeatStatus } from "@/lib/types/entradas";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Falta slug" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const resolved = await resolveVentaAbonoPublica(db, slug);
    if (!resolved) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const mapId = resolved.subcomision.ventaAbonoPublica?.plateasEventoMapaId?.trim();
    if (!mapId) {
      return NextResponse.json(
        {
          error: "NO_MAPA",
          hint: "En el admin, pestaña Abono web: completá «ID del partido para el plano» (documento en plateasEventos).",
        },
        { status: 400 }
      );
    }

    const eventRef = db.collection("subcomisiones").doc(resolved.subcomisionId).collection("plateasEventos").doc(mapId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json(
        { error: "EVENTO_NO_ENCONTRADO", hint: `No existe plateasEventos/${mapId} en esta subcomisión.` },
        { status: 404 }
      );
    }

    const ev = eventSnap.data() as { titulo?: string; fechaPartido?: string };
    const asientosSnap = await eventRef.collection("asientos").get();
    const byId = new Map(asientosSnap.docs.map((d) => [d.id, d.data() as { estado?: string; titularNombre?: string }]));

    const layout = getBasquetPlateasDemoLayout();
    const seats = layout.map((L) => {
      const doc = byId.get(L.id);
      const estado = (doc?.estado as PlateaSeatStatus) ?? "disponible";
      return {
        id: L.id,
        numeroVisible: L.numeroVisible,
        sector: L.sector,
        estado,
        titularNombre: doc?.titularNombre,
      };
    });

    return NextResponse.json({
      eventId: mapId,
      eventTitulo: ev.titulo ?? mapId,
      fechaPartido: ev.fechaPartido ?? "",
      seats,
    });
  } catch (e) {
    console.error("[abonos/plano-publico]", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
