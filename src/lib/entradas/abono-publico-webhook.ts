/**
 * Pago aprobado de venta pública de abono (sin login / sin asiento en mapa).
 */

import type admin from "firebase-admin";
import { ABONO_PUBLICO_EVENT_ID, ABONO_PUBLICO_SEAT_ID } from "@/lib/entradas/abono-publico-constants";

export async function applyAbonoPublicoMercadoPagoApproved(
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

  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    console.warn("[abono publico mp] pendiente inexistente", pendingId);
    return;
  }

  const p = pendingSnap.data() as {
    tipo?: string;
    eventId?: string;
    seatId?: string;
    amount?: number;
    buyerDisplayName?: string;
    buyerEmail?: string;
    tier?: string;
  };

  if (
    p.eventId !== ABONO_PUBLICO_EVENT_ID ||
    p.seatId !== ABONO_PUBLICO_SEAT_ID ||
    p.tipo !== "abono_publico"
  ) {
    console.warn("[abono publico mp] pendiente no es abono público", pendingId);
    return;
  }

  const expected = Math.round(Number(p.amount) * 100) / 100;
  const got = Math.round(amount * 100) / 100;
  if (expected > 0 && Math.abs(expected - got) > 0.02) {
    console.warn("[abono publico mp] monto distinto", { expected, got, pendingId });
    return;
  }

  const compraRef = db
    .collection("subcomisiones")
    .doc(schoolId)
    .collection("comprasAbonoPublico")
    .doc(pendingId);

  const firebaseAdmin = await import("firebase-admin");
  const now = firebaseAdmin.firestore.Timestamp.now();

  await db.runTransaction(async (tx) => {
    const prev = await tx.get(compraRef);
    if (prev.data()?.mpPaymentId === paymentId) return;

    tx.set(compraRef, {
      mpPaymentId: paymentId,
      paidAt: now,
      buyerEmail: p.buyerEmail ?? null,
      buyerDisplayName: p.buyerDisplayName ?? "",
      tier: p.tier ?? null,
      amount: got,
      currency: currency || "ARS",
      estado: "pagado",
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
