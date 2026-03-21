/**
 * Provider: Mercado Pago — STUB
 * Regatas+ — Habilitar cuando lleguen credenciales
 */

import type { IPaymentProvider, PaymentData, PaymentResult } from '../IPaymentProvider';

export class MercadoPagoProvider implements IPaymentProvider {
  nombre = 'mercadopago';
  disponible = process.env.MP_ENABLED === 'true';

  async iniciarPago(_data: PaymentData): Promise<PaymentResult> {
    if (!this.disponible) {
      throw new Error('Mercado Pago no disponible aún. Próximamente.');
    }
    throw new Error('Mercado Pago no implementado aún.');
  }

  async confirmarPago(_providerPaymentId: string, _rawPayload?: unknown): Promise<boolean> {
    return false;
  }

  verificarWebhook(_payload: unknown, _signature: string): boolean {
    return false;
  }
}
