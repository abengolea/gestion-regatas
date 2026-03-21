/**
 * POST /api/webhooks/santander
 * Webhook Santander Pay — STUB
 * Devuelve 200 siempre. Implementar cuando Santander Pay esté habilitado.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
