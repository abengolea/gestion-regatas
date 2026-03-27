/**
 * GET /api/entradas/abonado/contexto?slug=xxx
 * Nombre de la subcomisión para el encabezado (sin datos sensibles).
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveSubcomisionByPublicSlug } from "@/lib/subcomision/resolve-by-public-slug";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Falta slug" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const r = await resolveSubcomisionByPublicSlug(db, slug);
    if (!r) {
      return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
    }
    return NextResponse.json({
      slug,
      subcomisionId: r.subcomisionId,
      subcomisionNombre: r.name,
    });
  } catch (e) {
    console.error("[entradas/abonado/contexto]", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
