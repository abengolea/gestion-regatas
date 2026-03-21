/**
 * Provider: Transferencia + comprobante vía App (upload directo)
 * Regatas+
 */

import type { IPaymentProvider, PaymentData, PaymentResult } from '../IPaymentProvider';
import { getAdminFirestore } from '@/lib/firebase-admin';

export class TransferenciaAppProvider implements IPaymentProvider {
  nombre = 'transferencia_app';
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
        metodoPago: 'transferencia_app',
        estado: 'pendiente',
        celularPagador: data.pagadorCelular,
        creadoEn: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const signedUploadUrl = `${baseUrl}/api/pagos/comprobante?viajeId=${data.viajeId}&socioId=${data.socioId}`;

    return {
      success: true,
      instrucciones: {
        cbu,
        alias,
        banco,
        monto: Math.round(data.monto),
        concepto: data.concepto,
        signedUploadUrl,
      },
    };
  }

  async confirmarPago(_providerPaymentId: string, _rawPayload?: unknown): Promise<boolean> {
    return false;
  }
}
