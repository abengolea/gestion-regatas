/**
 * Ubica la subcomisión con venta de abono pública a partir del segmento de URL.
 *
 * 1) Consultas por ventaAbonoPublica.slug, luego subcomisiones.slug, luego id del doc.
 * 2) Si no hay resultados (p. ej. índice), escanea subcomisiones (límite 500) y compara slugs/id.
 */

import type admin from "firebase-admin";
import type { Subcomision, VentaAbonoPublica } from "@/lib/types";

export type SubcomisionConAbono = Subcomision & { ventaAbonoPublica: VentaAbonoPublica };

const MAX_SCAN = 500;

function normSlug(s: string): string {
  return s.trim().toLowerCase();
}

/** Firestore a veces guarda activa como string "true". */
export function ventaAbonoEstaActiva(v: VentaAbonoPublica | undefined): v is VentaAbonoPublica {
  if (!v || typeof v !== "object") return false;
  const a = v.activa as unknown;
  if (a === false || a === 0) return false;
  if (a === true || a === 1) return true;
  if (typeof a === "string") {
    const t = a.trim().toLowerCase();
    return t === "true" || t === "1" || t === "si" || t === "sí";
  }
  return false;
}

function coincideUrlSlug(
  urlSlug: string,
  docId: string,
  schoolSlug: string | undefined,
  v: VentaAbonoPublica
): boolean {
  const u = normSlug(urlSlug);
  if (!u) return false;
  if (normSlug(docId) === u || docId === urlSlug.trim()) return true;
  if (schoolSlug && normSlug(schoolSlug) === u) return true;
  if (v.slug && normSlug(v.slug) === u) return true;
  return false;
}

function wrap(
  id: string,
  raw: Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica },
  v: VentaAbonoPublica
): { subcomisionId: string; subcomision: SubcomisionConAbono } {
  return {
    subcomisionId: id,
    subcomision: { ...raw, id, ventaAbonoPublica: v },
  };
}

export async function resolveVentaAbonoPublica(
  db: admin.firestore.Firestore,
  urlSlug: string
): Promise<{ subcomisionId: string; subcomision: SubcomisionConAbono } | null> {
  const slug = urlSlug.trim();
  if (!slug) return null;

  const tryQueries = async () => {
    try {
      const qs = await db.collection("subcomisiones").where("ventaAbonoPublica.slug", "==", slug).limit(1).get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica };
        const v = raw.ventaAbonoPublica;
        if (ventaAbonoEstaActiva(v)) return wrap(doc.id, raw, v);
      }
    } catch (e) {
      console.warn("[resolveVentaAbono] where ventaAbonoPublica.slug:", e);
    }

    try {
      const qs = await db.collection("subcomisiones").where("slug", "==", slug).limit(1).get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica };
        const v = raw.ventaAbonoPublica;
        if (ventaAbonoEstaActiva(v)) return wrap(doc.id, raw, v);
      }
    } catch (e) {
      console.warn("[resolveVentaAbono] where slug:", e);
    }

    try {
      const qs = await db
        .collection("subcomisiones")
        .where("slug", "==", normSlug(slug))
        .limit(1)
        .get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica };
        const v = raw.ventaAbonoPublica;
        if (ventaAbonoEstaActiva(v)) return wrap(doc.id, raw, v);
      }
    } catch (e) {
      console.warn("[resolveVentaAbono] where slug normalized:", e);
    }

    try {
      const doc = await db.collection("subcomisiones").doc(slug).get();
      if (doc.exists) {
        const raw = doc.data() as Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica };
        const v = raw.ventaAbonoPublica;
        if (ventaAbonoEstaActiva(v)) return wrap(doc.id, raw, v);
      }
    } catch (e) {
      console.warn("[resolveVentaAbono] get by id:", e);
    }

    return null;
  };

  const fromQuery = await tryQueries();
  if (fromQuery) return fromQuery;

  try {
    const snap = await db.collection("subcomisiones").limit(MAX_SCAN).get();
    for (const doc of snap.docs) {
      const raw = doc.data() as Omit<Subcomision, "id"> & { ventaAbonoPublica?: VentaAbonoPublica };
      const v = raw.ventaAbonoPublica;
      if (!ventaAbonoEstaActiva(v)) continue;
      if (coincideUrlSlug(slug, doc.id, raw.slug, v)) {
        return wrap(doc.id, raw, v);
      }
    }
  } catch (e) {
    console.warn("[resolveVentaAbono] scan subcomisiones:", e);
  }

  return null;
}
