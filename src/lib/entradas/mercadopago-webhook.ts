/**
 * Confirma compra de platea(s) cuando Mercado Pago aprueba el pago.
 * external_reference: schoolId|pendingId|entrada:eventId:seatId (uno)
 * o schoolId|pendingId|entrada-multi (varios; seatIds en el doc pendiente).
 */

import type admin from 'firebase-admin';

type PendingEntrada = {
  eventId?: string;
  seatId?: string;
  seatIds?: string[];
  estado?: string;
  amount?: number;
  buyerDisplayName?: string;
  buyerEmail?: string;
  buyerSocioId?: string;
};

export async function applyEntradaMercadoPagoApproved(
  db: admin.firestore.Firestore,
  params: {
    schoolId: string;
    pendingId: string;
    paymentId: string;
    amount: number;
    /** Referencia legacy en external_reference (una sola platea) */
    legacyEventId?: string;
    legacySeatId?: string;
  }
): Promise<void> {
  const { schoolId, pendingId, paymentId, amount, legacyEventId, legacySeatId } = params;

  const pendingRef = db
    .collection('subcomisiones')
    .doc(schoolId)
    .collection('entradasPagosPendientes')
    .doc(pendingId);

  const firebaseAdmin = await import('firebase-admin');
  const now = firebaseAdmin.firestore.Timestamp.now();

  await db.runTransaction(async (tx) => {
    const pendingSnap = await tx.get(pendingRef);
    if (!pendingSnap.exists) {
      console.warn('[entrada mp] pago pendiente inexistente', pendingId);
      return;
    }

    const p = pendingSnap.data() as PendingEntrada;
    if (p.estado === 'completado') {
      return;
    }

    if (legacyEventId != null && legacySeatId != null) {
      if (p.eventId !== legacyEventId) {
        console.warn('[entrada mp] eventId no coincide con pendiente', { pendingId });
        return;
      }
      const single = p.seatId ?? p.seatIds?.[0];
      if (single !== legacySeatId) {
        console.warn('[entrada mp] seatId no coincide con pendiente', { pendingId });
        return;
      }
    }

    const seatIds =
      Array.isArray(p.seatIds) && p.seatIds.length > 0 ? p.seatIds : p.seatId ? [p.seatId] : [];
    const eventId = p.eventId;
    if (!eventId || seatIds.length === 0) {
      console.warn('[entrada mp] pendiente sin eventId o asientos', pendingId);
      return;
    }

    const expected = Math.round(Number(p.amount) * 100) / 100;
    const got = Math.round(amount * 100) / 100;
    if (expected > 0 && Math.abs(expected - got) > 0.02) {
      console.warn('[entrada mp] monto distinto', { expected, got, pendingId });
      return;
    }

    for (const seatId of seatIds) {
      const seatRef = db
        .collection('subcomisiones')
        .doc(schoolId)
        .collection('plateasEventos')
        .doc(eventId)
        .collection('asientos')
        .doc(seatId);

      const seatSnap = await tx.get(seatRef);
      const prev = seatSnap.data() as
        | {
            estado?: string;
            mpPaymentId?: string;
            reservaPendingId?: string;
          }
        | undefined;

      if (prev?.mpPaymentId === paymentId) {
        continue;
      }

      if (prev?.estado === 'pagado' || prev?.estado === 'abonado_fijo' || prev?.estado === 'reservado_manual') {
        console.warn('[entrada mp] asiento ya ocupado', seatId);
        return;
      }

      if (prev?.estado === 'reservado' && prev.reservaPendingId && prev.reservaPendingId !== pendingId) {
        console.warn('[entrada mp] reserva de otro pendiente', seatId);
        return;
      }

      tx.set(
        seatRef,
        {
          estado: 'pagado',
          mpPaymentId: paymentId,
          pagoConfirmadoEn: now,
          titularNombre: p.buyerDisplayName ?? '',
          titularEmail: p.buyerEmail ?? null,
          titularSocioId: p.buyerSocioId ?? null,
          reservaPendingId: firebaseAdmin.firestore.FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    tx.set(
      pendingRef,
      {
        estado: 'completado',
        mpPaymentId: paymentId,
        completedAt: now,
      },
      { merge: true }
    );
  });
}
