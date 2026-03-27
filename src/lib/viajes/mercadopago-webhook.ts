/**
 * Marca como pagado el pago de un viaje cuando MP confirma el cobro
 * vía webhook con external_reference schoolId|playerId|viaje-{viajeId}.
 */

import type admin from 'firebase-admin';

export async function applyViajeMercadoPagoApproved(
  db: admin.firestore.Firestore,
  params: {
    schoolId: string;
    playerId: string;
    viajeId: string;
    paymentId: string;
    amount: number;
  }
): Promise<void> {
  const { schoolId, playerId, viajeId, paymentId, amount } = params;

  const viajeSnap = await db.collection('viajes').doc(viajeId).get();
  if (!viajeSnap.exists) {
    console.warn('[mercadopago-webhook viaje] viaje inexistente', viajeId);
    return;
  }

  const subcomisionId = viajeSnap.data()?.subcomisionId as string | undefined;
  if (subcomisionId && subcomisionId !== schoolId) {
    console.warn('[mercadopago-webhook viaje] subcomisión no coincide con la referencia', {
      subcomisionId,
      schoolId,
    });
    return;
  }

  const firebaseAdmin = await import('firebase-admin');
  const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(playerId);

  await pagoRef.set(
    {
      estado: 'pagado',
      mpPaymentId: String(paymentId),
      monto: amount,
      confirmadoEn: firebaseAdmin.firestore.Timestamp.now(),
      updatedAt: firebaseAdmin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
}
