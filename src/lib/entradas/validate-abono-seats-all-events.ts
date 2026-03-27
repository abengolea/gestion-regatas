import type admin from "firebase-admin";
import type { PlateaSeatStatus } from "@/lib/types/entradas";

export type AbonoSeatsValidation =
  | { ok: true }
  | { ok: false; error: string; eventId?: string; seatId?: string; estado?: string };

/** Solo estas bases permiten tomar el abono en todos los partidos cargados. */
const OK_ABONO: PlateaSeatStatus[] = ["disponible", "liberado_temporal"];

export async function validateAbonoSeatsAvailableAllEvents(
  db: admin.firestore.Firestore,
  subcomisionId: string,
  seatIds: string[]
): Promise<AbonoSeatsValidation> {
  const unique = [...new Set(seatIds)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: false, error: "Sin plateas elegidas" };
  }

  const eventsSnap = await db
    .collection("subcomisiones")
    .doc(subcomisionId)
    .collection("plateasEventos")
    .get();

  if (eventsSnap.empty) {
    return {
      ok: false,
      error: "No hay partidos (plateasEventos) en esta sede. Creá al menos un evento con asientos.",
    };
  }

  for (const evDoc of eventsSnap.docs) {
    for (const seatId of unique) {
      const snap = await evDoc.ref.collection("asientos").doc(seatId).get();
      if (!snap.exists) {
        return {
          ok: false,
          error: `En el partido «${evDoc.id}» no existe el asiento «${seatId}». Replicá los ids del layout en todos los eventos.`,
          eventId: evDoc.id,
          seatId,
        };
      }
      const st = (snap.data()?.estado as PlateaSeatStatus | undefined) ?? "disponible";
      if (!OK_ABONO.includes(st)) {
        return {
          ok: false,
          error: `La platea ${seatId} no está libre en todos los partidos (${evDoc.id}: ${st}).`,
          eventId: evDoc.id,
          seatId,
          estado: st,
        };
      }
    }
  }

  return { ok: true };
}
