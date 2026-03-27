/**
 * Resuelve subcomisión por segmento de URL (id del doc, campo slug o ventaAbonoPublica.slug).
 * No exige venta de abono activa — sirve para páginas públicas de entradas.
 */

import type admin from "firebase-admin";
import type { Subcomision, VentaAbonoPublica } from "@/lib/types";

const MAX_SCAN = 500;

function normSlug(s: string): string {
  return s.trim().toLowerCase();
}

function coincideUrlSlug(
  urlSlug: string,
  docId: string,
  schoolSlug: string | undefined,
  venta?: VentaAbonoPublica
): boolean {
  const u = normSlug(urlSlug);
  if (!u) return false;
  if (normSlug(docId) === u || docId === urlSlug.trim()) return true;
  if (schoolSlug && normSlug(schoolSlug) === u) return true;
  if (venta?.slug && normSlug(venta.slug) === u) return true;
  return false;
}

export type SubcomisionResuelta = {
  subcomisionId: string;
  name: string;
};

export async function resolveSubcomisionByPublicSlug(
  db: admin.firestore.Firestore,
  urlSlug: string
): Promise<SubcomisionResuelta | null> {
  const slug = urlSlug.trim();
  if (!slug) return null;

  const tryQueries = async (): Promise<SubcomisionResuelta | null> => {
    try {
      const qs = await db.collection("subcomisiones").where("ventaAbonoPublica.slug", "==", slug).limit(1).get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Subcomision;
        return { subcomisionId: doc.id, name: raw.name ?? doc.id };
      }
    } catch {
      /* índice opcional */
    }

    try {
      const qs = await db.collection("subcomisiones").where("slug", "==", slug).limit(1).get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Subcomision;
        return { subcomisionId: doc.id, name: raw.name ?? doc.id };
      }
    } catch {
      /* */
    }

    try {
      const qs = await db
        .collection("subcomisiones")
        .where("slug", "==", normSlug(slug))
        .limit(1)
        .get();
      if (!qs.empty) {
        const doc = qs.docs[0];
        const raw = doc.data() as Subcomision;
        return { subcomisionId: doc.id, name: raw.name ?? doc.id };
      }
    } catch {
      /* */
    }

    try {
      const doc = await db.collection("subcomisiones").doc(slug).get();
      if (doc.exists) {
        const raw = doc.data() as Subcomision;
        return { subcomisionId: doc.id, name: raw.name ?? doc.id };
      }
    } catch {
      /* */
    }

    return null;
  };

  const found = await tryQueries();
  if (found) return found;

  try {
    const snap = await db.collection("subcomisiones").limit(MAX_SCAN).get();
    for (const doc of snap.docs) {
      const raw = doc.data() as Subcomision;
      if (coincideUrlSlug(slug, doc.id, raw.slug, raw.ventaAbonoPublica)) {
        return { subcomisionId: doc.id, name: raw.name ?? doc.id };
      }
    }
  } catch {
    /* */
  }

  return null;
}
