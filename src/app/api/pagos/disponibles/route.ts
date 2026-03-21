/**
 * GET /api/pagos/disponibles
 * Lista todos los métodos de pago con flag disponible (para UI).
 * Permite mostrar MP y Santander deshabilitados "próximamente".
 */

import { NextResponse } from 'next/server';
import { PaymentRegistry } from '@/lib/payments/PaymentRegistry';
import type { MetodoPagoKey } from '@/lib/payments/IPaymentProvider';

const LABELS: Record<string, string> = {
  transferencia_whatsapp: 'Mandar comprobante por WhatsApp',
  transferencia_app: 'Subir comprobante aquí',
  mercadopago: 'Mercado Pago',
  santander_pay: 'Santander Pay',
};

const METODOS: MetodoPagoKey[] = [
  'transferencia_whatsapp',
  'transferencia_app',
  'mercadopago',
  'santander_pay',
];

export async function GET() {
  const disponibles = new Set(
    PaymentRegistry.disponibles().map((p) => p.nombre)
  );

  return NextResponse.json(
    METODOS.map((nombre) => ({
      nombre,
      label: LABELS[nombre] ?? nombre,
      disponible: disponibles.has(nombre),
    }))
  );
}
