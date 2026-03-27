/**
 * GET /api/notificashub/status
 * Solo en desarrollo: indica si las env del servidor están definidas (sin revelar valores).
 */

import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = Boolean(process.env.NOTIFICASHUB_URL?.trim());
  const secret =
    Boolean(process.env.NOTIFICASHUB_INTERNAL_SECRET?.trim()) ||
    Boolean(process.env.INTERNAL_SECRET?.trim());

  return NextResponse.json({
    modo: 'desarrollo',
    NOTIFICASHUB_URL_configurada: url,
    secreto_hub_configurado: secret,
    listo_para_llamar_al_hub: url && secret,
    ayuda:
      'Si listo_para_llamar_al_hub es false, definí NOTIFICASHUB_URL y NOTIFICASHUB_INTERNAL_SECRET o INTERNAL_SECRET en .env.local.',
  });
}
