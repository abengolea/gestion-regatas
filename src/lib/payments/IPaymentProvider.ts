/**
 * Interfaz base para métodos de pago.
 * Payment Provider Pattern — Regatas+
 */

export interface PaymentResult {
  success: boolean;
  providerPaymentId?: string;
  redirectUrl?: string;
  instrucciones?: {
    cbu: string;
    alias: string;
    banco: string;
    monto: number;
    concepto: string;
    signedUploadUrl?: string;
  };
  error?: string;
}

export interface PaymentData {
  viajeId: string;
  socioId: string;
  monto: number;
  concepto: string;
  pagadorNombre: string;
  pagadorCelular: string;
  pagadorEmail?: string;
  comprobanteUrl?: string;
}

export interface IPaymentProvider {
  nombre: string;
  disponible: boolean;
  iniciarPago(data: PaymentData): Promise<PaymentResult>;
  confirmarPago(providerPaymentId: string, rawPayload?: unknown): Promise<boolean>;
  verificarWebhook?(payload: unknown, signature: string): boolean;
}

export type MetodoPagoKey =
  | 'transferencia_whatsapp'
  | 'transferencia_app'
  | 'mercadopago'
  | 'santander_pay';
