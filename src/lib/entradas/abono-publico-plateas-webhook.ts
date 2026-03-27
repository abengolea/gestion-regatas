/**
 * Pago aprobado: abono público con plateas elegidas — marca abonado_fijo en todos los plateasEventos.
 */

import type admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PlateaSeatStatus } from "@/lib/types/entradas";

type PendingAbonoPlateas = {
  tipo?: string;
  estado?: string;
  seatIds?: string[];
  abonoMapEventId?: string;
  amount?: number;
  buyerDisplayName?: string;
  buyerEmail?: string | null;
  buyerTelefono?: string | null;
  buyerDni?: string | null;
  tier?: string;
};

function canAssignAbonoOnSeat(
  eventId: string,
  mapEventId: string,
  pendingId: string,
  estado: string | undefined,
  reservaPendingId: string | undefined
): boolean {
  const st = (estado ?? "disponible") as PlateaSeatStatus;
  if (st === "disponible" || st === "liberado_temporal") return true;
  if (eventId === mapEventId && st === "reservado" && reservaPendingId === pendingId) return true;
  return false;
}

export async function applyAbonoPublicoPlateasMercadoPagoApproved(
  db: admin.firestore.Firestore,
  params: {
    schoolId: string;
    pendingId: string;
    paymentId: string;
    amount: number;
    currency: string;
  }
): Promise<void> {
  const { schoolId, pendingId, paymentId, amount, currency } = params;
  const pendingRef = db
    .collection("subcomisiones")
    .doc(schoolId)
    .collection("entradasPagosPendientes")
    .doc(pendingId);

  const firebaseAdmin = await import("firebase-admin");
  const now = firebaseAdmin.firestore.Timestamp.now();
  const compraRef = db.collection("subcomisiones").doc(schoolId).collection("comprasAbonoPublico").doc(pendingId);

  const eventsSnap = await db.collection("subcomisiones").doc(schoolId).collection("plateasEventos").get();
  const eventIds = eventsSnap.docs.map((d) => d.id);

  await db.runTransaction(async (tx) => {
    const pendingSnap = await tx.get(pendingRef);
    if (!pendingSnap.exists) {
      console.warn("[abono plateas mp] pendiente inexistente", pendingId);
      return;
    }

    const p = pendingSnap.data() as PendingAbonoPlateas;
    if (p.estado === "completado") return;

    if (p.tipo !== "abono_publico" || !Array.isArray(p.seatIds) || p.seatIds.length === 0 || !p.abonoMapEventId) {
      console.warn("[abono plateas mp] pendiente no es abono con plateas", pendingId);
      return;
    }

    const seatIds = [...new Set(p.seatIds)];
    const expected = Math.round(Number(p.amount) * 100) / 100;
    const got = Math.round(amount * 100) / 100;
    if (expected > 0 && Math.abs(expected - got) > 0.02) {
      console.warn("[abono plateas mp] monto distinto", { expected, got, pendingId });
      return;
    }

    const prevCompra = await tx.get(compraRef);
    if (prevCompra.data()?.mpPaymentId === paymentId) return;

    for (const eventId of eventIds) {
      for (const seatId of seatIds) {
        const seatRef = db
          .collection("subcomisiones")
          .doc(schoolId)
          .collection("plateasEventos")
          .doc(eventId)
          .collection("asientos")
          .doc(seatId);

        const seatSnap = await tx.get(seatRef);
        if (!seatSnap.exists) continue;

        const prev = seatSnap.data() as {
          estado?: string;
          mpPaymentId?: string;
          reservaPendingId?: string;
        };

        if (prev.mpPaymentId === paymentId) continue;

        if (
          !canAssignAbonoOnSeat(eventId, p.abonoMapEventId!, pendingId, prev.estado, prev.reservaPendingId)
        ) {
          if (eventId === p.abonoMapEventId) {
            console.warn("[abono plateas mp] asiento mapa no asignable tras pago", {
              pendingId,
              seatId,
              estado: prev.estado,
            });
            return;
          }
          continue;
        }

        tx.set(
          seatRef,
          {
            estado: "abonado_fijo",
            mpPaymentId: paymentId,
            pagoConfirmadoEn: now,
            titularNombre: p.buyerDisplayName ?? "",
            titularEmail: p.buyerEmail ?? null,
            titularDni: p.buyerDni ?? null,
            titularSocioId: FieldValue.delete(),
            reservaPreferenceId: FieldValue.delete(),
            reservaPendingId: FieldValue.delete(),
            reservadoDesde: FieldValue.delete(),
            liberadoEnEventoId: FieldValue.delete(),
            updatedAt: now,
          },
          { merge: true }
        );
      }
    }

    tx.set(compraRef, {
      mpPaymentId: paymentId,
      paidAt: now,
      buyerEmail: p.buyerEmail ?? null,
      buyerDisplayName: p.buyerDisplayName ?? "",
      buyerTelefono: p.buyerTelefono ?? null,
      buyerDni: p.buyerDni ?? null,
      tier: p.tier ?? null,
      amount: got,
      currency: currency || "ARS",
      estado: "pagado",
      seatIds,
      abonoMapEventId: p.abonoMapEventId,
    });

    tx.set(
      pendingRef,
      {
        estado: "completado",
        mpPaymentId: paymentId,
        completedAt: now,
      },
      { merge: true }
    );
  });
}
