/**
 * POST /api/entradas/abonado/partidos
 * Partidos con plateas donde el socio figura como titular.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAbonadoEntradasAuth } from "@/app/api/entradas/abonado/_auth";
import { getBasquetPlateasDemoLayout } from "@/lib/entradas/basquet-plateas-layout";
import type { PlateaSeatStatus } from "@/lib/types/entradas";

export async function POST(request: Request) {
  const auth = await requireAbonadoEntradasAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { subcomisionId, socioId } = auth.claims;

  try {
    const db = getAdminFirestore();
    const subSnap = await db.collection("subcomisiones").doc(subcomisionId).get();
    const subName = (subSnap.data()?.name as string | undefined) ?? subcomisionId;

    const evSnap = await db.collection("subcomisiones").doc(subcomisionId).collection("plateasEventos").get();

    const layout = getBasquetPlateasDemoLayout();
    const layoutById = new Map(layout.map((l) => [l.id, l]));

    type EvRaw = {
      titulo?: unknown;
      fechaPartido?: unknown;
      estado?: unknown;
      precioSocio?: unknown;
      precioGeneral?: unknown;
      moneda?: unknown;
    };

    const eventDocs = evSnap.docs
      .map((d) => {
        const raw = d.data() as EvRaw;
        return {
          id: d.id,
          titulo: raw.titulo,
          fechaPartido: raw.fechaPartido,
          estado: raw.estado,
          precioSocio: raw.precioSocio,
          precioGeneral: raw.precioGeneral,
          moneda: raw.moneda,
        };
      })
      .sort((a, b) => String(b.fechaPartido ?? "").localeCompare(String(a.fechaPartido ?? "")));

    const partidos: {
      eventId: string;
      titulo: string;
      fechaPartido: string;
      estado: string;
      precioSocio: number;
      precioGeneral: number;
      moneda: string;
      misAsientos: {
        seatId: string;
        numeroVisible: number;
        sector: string;
        estado: PlateaSeatStatus;
        titularNombre?: string;
      }[];
    }[] = [];

    for (const ev of eventDocs) {
      const asientosQ = await db
        .collection("subcomisiones")
        .doc(subcomisionId)
        .collection("plateasEventos")
        .doc(ev.id)
        .collection("asientos")
        .where("titularSocioId", "==", socioId)
        .get();

      if (asientosQ.empty) continue;

      const misAsientos = asientosQ.docs.map((doc) => {
        const a = doc.data() as {
          estado?: PlateaSeatStatus;
          titularNombre?: string;
        };
        const lay = layoutById.get(doc.id);
        return {
          seatId: doc.id,
          numeroVisible: lay?.numeroVisible ?? 0,
          sector: lay?.sector ?? "",
          estado: (a.estado as PlateaSeatStatus) ?? "disponible",
          titularNombre: a.titularNombre,
        };
      });

      partidos.push({
        eventId: ev.id,
        titulo: String(ev.titulo ?? "Partido"),
        fechaPartido: String(ev.fechaPartido ?? ""),
        estado: String(ev.estado ?? "borrador"),
        precioSocio: Number(ev.precioSocio ?? 0),
        precioGeneral: Number(ev.precioGeneral ?? 0),
        moneda: String(ev.moneda ?? "ARS"),
        misAsientos,
      });
    }

    return NextResponse.json({ subcomisionNombre: subName, partidos });
  } catch (e) {
    console.error("[entradas/abonado/partidos]", e);
    return NextResponse.json({ error: "No se pudo cargar la información" }, { status: 500 });
  }
}
