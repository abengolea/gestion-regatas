/**
 * POST /api/webhooks/mp
 * Webhook Mercado Pago — STUB
 * Devuelve 200 siempre. Implementar cuando MP esté habilitado.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
