/**
 * Provider: Santander Pay — STUB
 * Regatas+ — Habilitar cuando llegue la API
 */

import type { IPaymentProvider, PaymentData, PaymentResult } from '../IPaymentProvider';

export class SantanderPayProvider implements IPaymentProvider {
  nombre = 'santander_pay';
  disponible = process.env.SANTANDER_PAY_ENABLED === 'true';

  async iniciarPago(_data: PaymentData): Promise<PaymentResult> {
    if (!this.disponible) {
      throw new Error('Santander Pay no disponible aún. Próximamente.');
    }
    throw new Error('Santander Pay no implementado aún.');
  }

  async confirmarPago(_providerPaymentId: string, _rawPayload?: unknown): Promise<boolean> {
    return false;
  }

  verificarWebhook(_payload: unknown, _signature: string): boolean {
    return false;
  }
}
