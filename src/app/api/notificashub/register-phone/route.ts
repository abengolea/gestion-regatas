/**
 * POST /api/notificashub/register-phone
 * Registra el celular del tutor en NotificasHub (tras alta desde cliente si no pasó por bulk-import/update).
 */

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-server';
import { registerPhoneWithNotificasHub } from '@/lib/whatsapp/notificashub-register-user';

export async function POST(request: Request) {
  const auth = await verifyIdToken(request.headers.get('Authorization'));
  if (!auth?.uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phone) {
    return NextResponse.json({ error: 'phone requerido' }, { status: 400 });
  }

  const result = await registerPhoneWithNotificasHub(phone);
  if (!result.ok) {
    if (result.reason === 'config') {
      return NextResponse.json(
        { ok: false, error: 'NotificasHub no configurado en servidor' },
        { status: 503 }
      );
    }
    if (result.reason === 'invalid_phone') {
      return NextResponse.json({ ok: false, error: 'Teléfono inválido' }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: result.message, status: result.status },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
