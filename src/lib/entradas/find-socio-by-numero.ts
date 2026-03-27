import type admin from "firebase-admin";

export async function findSocioDocByNumeroSocio(
  db: admin.firestore.Firestore,
  subcomisionId: string,
  numeroSocioRaw: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const n = numeroSocioRaw.trim();
  if (!n) return null;
  const col = db.collection("subcomisiones").doc(subcomisionId).collection("socios");

  const variants = new Set<string>([n, n.replace(/^0+/, "") || "0"]);
  const num = Number(n);
  if (Number.isFinite(num)) {
    variants.add(String(num));
  }

  for (const v of variants) {
    if (!v) continue;
    const q = await col.where("numeroSocio", "==", v).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, data: d.data() };
    }
  }

  if (Number.isFinite(num)) {
    const q = await col.where("numeroSocio", "==", num).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, data: d.data() };
    }
  }

  return null;
}
