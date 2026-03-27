/**
 * POST /api/whatsapp/incoming
 * Recibe mensajes enrutados desde NotificasHub.
 * Verificar x-internal-secret, responder 200 inmediatamente, procesar async.
 */

import { NextResponse } from 'next/server';
import { WhatsAppBotHandler } from '@/lib/whatsapp/WhatsAppBotHandler';
import { getNotificasHubInternalSecret } from '@/lib/whatsapp/notificashub-env';

export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-secret');
  const expected = getNotificasHubInternalSecret();

  if (!expected || secret !== expected) {
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

  if (payload.tenantId !== 'regatas') {
    return NextResponse.json({ ok: true });
  }

  const fullPayload = {
    phone: payload.phone,
    tenantId: payload.tenantId ?? 'regatas',
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
