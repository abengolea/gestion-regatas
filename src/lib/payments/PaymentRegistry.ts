/**
 * Registro central de métodos de pago.
 * Única puerta de entrada — nunca instanciar providers directamente.
 * Regatas+
 */

import type { IPaymentProvider, MetodoPagoKey } from './IPaymentProvider';
import { TransferenciaWhatsAppProvider } from './providers/TransferenciaWhatsAppProvider';
import { TransferenciaAppProvider } from './providers/TransferenciaAppProvider';
import { MercadoPagoProvider } from './providers/MercadoPagoProvider';
import { SantanderPayProvider } from './providers/SantanderPayProvider';

const providers = new Map<MetodoPagoKey, IPaymentProvider>([
  ['transferencia_whatsapp', new TransferenciaWhatsAppProvider()],
  ['transferencia_app', new TransferenciaAppProvider()],
  ['mercadopago', new MercadoPagoProvider()],
  ['santander_pay', new SantanderPayProvider()],
]);

export class PaymentRegistry {
  static get(nombre: string): IPaymentProvider {
    const p = providers.get(nombre as MetodoPagoKey);
    if (!p) throw new Error(`Provider ${nombre} no registrado`);
    if (!p.disponible) throw new Error(`Provider ${nombre} no disponible aún`);
    return p;
  }

  static disponibles(): IPaymentProvider[] {
    return [...providers.values()].filter((p) => p.disponible);
  }

  static tieneDisponible(nombre: string): boolean {
    const p = providers.get(nombre as MetodoPagoKey);
    return !!p?.disponible;
  }
}
