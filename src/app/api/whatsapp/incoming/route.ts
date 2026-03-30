/**
 * POST /api/whatsapp/incoming
 * Recibe mensajes enrutados desde NotificasHub (payload `regatas_plus`).
 * Auth: `x-internal-secret` (recomendado en hub: `internalAuthHeader`) o `x-internal-token` con el mismo valor.
 */

import { NextResponse } from 'next/server';
import { WhatsAppBotHandler } from '@/lib/whatsapp/WhatsAppBotHandler';
import {
  getNotificasHubInternalSecret,
  getNotificasHubTenantId,
} from '@/lib/whatsapp/notificashub-env';

export async function POST(request: Request) {
  const expected = getNotificasHubInternalSecret();
  const provided =
    request.headers.get('x-internal-secret') ??
    request.headers.get('x-internal-token');

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: {
    phone?: string;
    tenantId?: string;
    message?: { type?: string; imageUrl?: string; text?: string };
    waMessageId?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.phone || !payload.message) {
    return NextResponse.json({ ok: true });
  }

  const ourTenant = getNotificasHubTenantId();
  const tenantId = payload.tenantId ?? ourTenant;
  if (tenantId !== ourTenant) {
    console.warn(
      '[whatsapp/incoming] Mensaje no procesado: tenantId=',
      payload.tenantId,
      'esperado=',
      ourTenant
    );
    return NextResponse.json({ ok: true });
  }

  const fullPayload = {
    phone: payload.phone,
    tenantId,
    message: {
      type: (payload.message.type ?? 'text') as 'image' | 'text',
      imageUrl: payload.message.imageUrl,
      text: payload.message.text,
    },
    waMessageId: payload.waMessageId ?? '',
  };

  process.nextTick(() => {
    WhatsAppBotHandler.handle(fullPayload).catch((e) => {
      console.error('[whatsapp/incoming]', e);
    });
  });

  return NextResponse.json({ ok: true });
}
