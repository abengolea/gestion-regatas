/**
 * GET /api/abonos/publica?slug=xxx
 * Datos de la campaña de abono público (sin secretos). Sin autenticación.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveVentaAbonoPublica } from "@/lib/entradas/resolve-venta-abono-publica";

const HINT_404 =
  "En Firebase → Firestore → colección «subcomisiones» → elegí el documento de tu sede (mismo id que usás en el admin). " +
  "Añadí un campo mapa «ventaAbonoPublica» con: activa = true (booleano; si pusiste texto «true», también se acepta), " +
  "titulo (string), precioSocio y precioGeneral (número), moneda «ARS». " +
  "La última parte de la URL debe coincidir con el id del documento, el campo slug de la subcomisión, o ventaAbonoPublica.slug (mayúsculas ignoradas en slugs).";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Falta slug" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const resolved = await resolveVentaAbonoPublica(db, slug);

    if (!resolved) {
      return NextResponse.json({ error: "No encontrado", hint: HINT_404 }, { status: 404 });
    }

    const { subcomision } = resolved;
    const v = subcomision.ventaAbonoPublica;

    const mapId = typeof v.plateasEventoMapaId === "string" ? v.plateasEventoMapaId.trim() : "";

    return NextResponse.json({
      slug,
      subcomisionNombre: subcomision.name ?? resolved.subcomisionId,
      titulo: v.titulo,
      descripcion: v.descripcion ?? "",
      precioSocio: Number(v.precioSocio),
      precioGeneral: Number(v.precioGeneral),
      moneda: v.moneda || "ARS",
      plateasEventoMapaId: mapId || null,
      planoAbonoConfigurado: Boolean(mapId),
    });
  } catch (e) {
    console.error("[abonos/publica]", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
