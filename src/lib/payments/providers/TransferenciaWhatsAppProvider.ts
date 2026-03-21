/**
 * Provider: Transferencia + comprobante vía WhatsApp (NotificasHub)
 * Regatas+
 */

import type { IPaymentProvider, PaymentData, PaymentResult } from '../IPaymentProvider';
import { getAdminFirestore } from '@/lib/firebase-admin';

export class TransferenciaWhatsAppProvider implements IPaymentProvider {
  nombre = 'transferencia_whatsapp';
  disponible = true;

  async iniciarPago(data: PaymentData): Promise<PaymentResult> {
    const db = getAdminFirestore();
    const admin = await import('firebase-admin');

    const cbu = process.env.CLUB_CBU ?? '';
    const alias = process.env.CLUB_ALIAS ?? '';
    const banco = process.env.CLUB_BANCO ?? 'Santander';

    if (!cbu || !alias) {
      return {
        success: false,
        error: 'CBU y alias del club no configurados',
      };
    }

    const pagoRef = db.collection('viajes').doc(data.viajeId).collection('pagos').doc(data.socioId);

    await pagoRef.set(
      {
        viajeId: data.viajeId,
        socioId: data.socioId,
        monto: Math.round(data.monto),
        metodoPago: 'transferencia_whatsapp',
        estado: 'pendiente',
        celularPagador: data.pagadorCelular,
        creadoEn: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    return {
      success: true,
      instrucciones: {
        cbu,
        alias,
        banco,
        monto: Math.round(data.monto),
        concepto: data.concepto,
      },
    };
  }

  async confirmarPago(_providerPaymentId: string, _rawPayload?: unknown): Promise<boolean> {
    return false;
  }
}
