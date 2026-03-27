/**
 * Registro / baja de teléfono en NotificasHub (user_memberships por tenant).
 * POST / DELETE {NOTIFICASHUB_URL}/api/register-user
 */

import { normalizePhoneForNotificasHub } from './normalize-phone';
import { getNotificasHubInternalSecret } from './notificashub-env';

const TENANT_ID = 'regatas' as const;

export type NotificasHubRegisterResult =
  | { ok: true }
  | { ok: false; reason: 'config' | 'invalid_phone' | 'http'; status?: number; message: string };

function getBaseUrl(): string {
  return (process.env.NOTIFICASHUB_URL ?? '').trim().replace(/\/$/, '');
}

function getSecret(): string {
  return getNotificasHubInternalSecret();
}

function logHttpError(context: string, status: number, bodyPreview: string): void {
  if (status === 401) {
    console.warn(`[NotificasHub ${context}] 401 — revisá NOTIFICASHUB_INTERNAL_SECRET y tenants/${TENANT_ID}.internalSecret`);
    return;
  }
  if (status === 400) {
    console.warn(`[NotificasHub ${context}] 400 — body inválido según el hub: ${bodyPreview.slice(0, 200)}`);
    return;
  }
  console.warn(`[NotificasHub ${context}] HTTP ${status}: ${bodyPreview.slice(0, 200)}`);
}

/**
 * Idempotente: el hub puede recibir la misma llamada varias veces.
 */
export async function registerPhoneWithNotificasHub(rawPhone: string): Promise<NotificasHubRegisterResult> {
  const baseUrl = getBaseUrl();
  const secret = getSecret();
  if (!baseUrl || !secret) {
    if (!baseUrl) console.warn('[NotificasHub register-user] NOTIFICASHUB_URL no configurado');
    if (!secret) console.warn('[NotificasHub register-user] NOTIFICASHUB_INTERNAL_SECRET o INTERNAL_SECRET no configurado');
    return { ok: false, reason: 'config', message: 'Missing NOTIFICASHUB_URL or hub internal secret' };
  }

  const phone = normalizePhoneForNotificasHub(rawPhone);
  if (!phone) {
    return { ok: false, reason: 'invalid_phone', message: 'Could not normalize phone' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/register-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
        'x-internal-token': secret,
      },
      body: JSON.stringify({ phone, tenantId: TENANT_ID }),
    });

    const text = await res.text();
    if (!res.ok) {
      logHttpError('register-user', res.status, text);
      return {
        ok: false,
        reason: 'http',
        status: res.status,
        message: res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[NotificasHub register-user] fetch error:', msg);
    return { ok: false, reason: 'http', message: msg };
  }
}

export async function unregisterPhoneFromNotificasHub(rawPhone: string): Promise<NotificasHubRegisterResult> {
  const baseUrl = getBaseUrl();
  const secret = getSecret();
  if (!baseUrl || !secret) {
    return { ok: false, reason: 'config', message: 'Missing env' };
  }

  const phone = normalizePhoneForNotificasHub(rawPhone);
  if (!phone) {
    return { ok: false, reason: 'invalid_phone', message: 'Could not normalize phone' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/register-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
        'x-internal-token': secret,
      },
      body: JSON.stringify({ phone, tenantId: TENANT_ID }),
    });

    const text = await res.text();
    if (!res.ok) {
      logHttpError('unregister-user', res.status, text);
      return {
        ok: false,
        reason: 'http',
        status: res.status,
        message: res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[NotificasHub unregister-user] fetch error:', msg);
    return { ok: false, reason: 'http', message: msg };
  }
}

type TutorFields = { tutorContact?: { phone?: string }; telefono?: string; celularPadre?: string };

function extractTutorPhoneFromDoc(data: TutorFields | undefined): string {
  if (!data) return '';
  const fromTutor = data.tutorContact?.phone;
  if (typeof fromTutor === 'string' && fromTutor.trim()) return fromTutor;
  if (typeof data.telefono === 'string' && data.telefono.trim()) return data.telefono;
  if (typeof data.celularPadre === 'string' && data.celularPadre.trim()) return data.celularPadre;
  return '';
}

/**
 * Tras cambiar teléfono del tutor: baja el número anterior (si cambió y era válido) y alta el nuevo.
 */
export async function syncNotificasHubTutorPhone(
  previousRaw: string | undefined | null,
  nextRaw: string | undefined | null
): Promise<void> {
  const prevNorm = normalizePhoneForNotificasHub(previousRaw ?? '');
  const nextNorm = normalizePhoneForNotificasHub(nextRaw ?? '');

  if (prevNorm && prevNorm !== nextNorm) {
    await unregisterPhoneFromNotificasHub(previousRaw ?? prevNorm);
  }
  if (nextNorm) {
    await registerPhoneWithNotificasHub(nextRaw ?? nextNorm);
  }
}

export async function syncNotificasHubFromPlayerDoc(
  previousData: TutorFields | undefined,
  nextTutorPhone: string | undefined | null
): Promise<void> {
  const prev = extractTutorPhoneFromDoc(previousData);
  await syncNotificasHubTutorPhone(prev, nextTutorPhone ?? '');
}
