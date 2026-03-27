/**
 * POST /api/entradas/abonado/verificar
 * Valida número de socio y devuelve JWT de sesión (sin cuenta Firebase).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveSubcomisionByPublicSlug } from "@/lib/subcomision/resolve-by-public-slug";
import { findSocioDocByNumeroSocio } from "@/lib/entradas/find-socio-by-numero";
import { signAbonadoEntradasToken } from "@/lib/entradas/abonado-entradas-jwt";

const bodySchema = z.object({
  slug: z.string().min(1),
  numeroSocio: z.string().min(1).max(32),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { slug, numeroSocio } = parsed.data;
    const db = getAdminFirestore();
    const sub = await resolveSubcomisionByPublicSlug(db, slug);
    if (!sub) {
      return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
    }

    const socio = await findSocioDocByNumeroSocio(db, sub.subcomisionId, numeroSocio);
    if (!socio) {
      return NextResponse.json(
        { error: "No encontramos un socio con ese número en esta sede. Verificá el dato o consultá en secretaría." },
        { status: 404 }
      );
    }

    const nombre = [socio.data.apellido, socio.data.nombre].filter(Boolean).join(" ").trim() || "Socio";
    const num =
      typeof socio.data.numeroSocio === "string" || typeof socio.data.numeroSocio === "number"
        ? String(socio.data.numeroSocio)
        : numeroSocio.trim();

    const token = await signAbonadoEntradasToken({
      subcomisionId: sub.subcomisionId,
      socioId: socio.id,
      numeroSocio: num,
    });

    return NextResponse.json({
      token,
      subcomisionId: sub.subcomisionId,
      subcomisionNombre: sub.name,
      socioId: socio.id,
      numeroSocio: num,
      nombre,
    });
  } catch (e) {
    console.error("[entradas/abonado/verificar]", e);
    return NextResponse.json({ error: "No se pudo verificar" }, { status: 500 });
  }
}
