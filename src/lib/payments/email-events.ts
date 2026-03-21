/**
 * Registro de eventos de email para idempotencia y envío vía Trigger Email.
 * SOLO servidor - usa firebase-admin.
 */

import type admin from 'firebase-admin';
import { buildEmailHtml, escapeHtml } from '@/lib/email';
import type { EmailEventType } from '@/lib/types/payments';

const MAIL_COLLECTION = 'mail';
const EMAIL_EVENTS_COLLECTION = 'emailEvents';

/** Genera idempotency key para evitar duplicados */
export function idempotencyKey(type: EmailEventType, socioId: string, period: string): string {
  return `${type}:${socioId}:${period}`;
}

export interface ReminderInfo {
  count: number;
  lastSentAt: Date;
}

/**
 * Obtiene el conteo de recordatorios enviados por (playerId, period) para payment_reminder_manual.
 * Sirve para mostrar en la tabla de morosos y evitar envíos duplicados.
 */
export async function getReminderCountsForDelinquents(
  db: admin.firestore.Firestore,
  subcomisionId: string,
  items: { playerId: string; period: string }[]
): Promise<Map<string, ReminderInfo>> {
  const map = new Map<string, ReminderInfo>();
  if (items.length === 0) return map;

  const snap = await db
    .collection(EMAIL_EVENTS_COLLECTION)
    .where('schoolId', '==', subcomisionId)
    .where('type', '==', 'payment_reminder_manual')
    .get();

  const keySet = new Set(items.map((i) => `${i.playerId}:${i.period}`));

  for (const doc of snap.docs) {
    const d = doc.data();
    const playerId = d.playerId as string;
    const period = d.period as string;
    const key = `${playerId}:${period}`;
    if (!keySet.has(key)) continue;

    const sentAt = d.sentAt?.toDate?.() ?? new Date();
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (sentAt > existing.lastSentAt) existing.lastSentAt = sentAt;
    } else {
      map.set(key, { count: 1, lastSentAt: sentAt });
    }
  }
  return map;
}

/** Verifica si ya se envió un email para esta combinación (idempotencia) */
export async function wasEmailSent(
  db: admin.firestore.Firestore,
  idempotencyKeyVal: string
): Promise<boolean> {
  const snap = await db
    .collection(EMAIL_EVENTS_COLLECTION)
    .where('idempotencyKey', '==', idempotencyKeyVal)
    .limit(1)
    .get();
  return !snap.empty;
}

/** Registra el evento de email enviado (para idempotencia) */
export async function recordEmailEvent(
  db: admin.firestore.Firestore,
  data: {
    type: EmailEventType;
    playerId: string;
    schoolId: string;
    period: string;
    idempotencyKey: string;
  }
): Promise<void> {
  const admin = await import('firebase-admin');
  await db.collection(EMAIL_EVENTS_COLLECTION).add({
    ...data,
    sentAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Encola un correo en la colección `mail` para Trigger Email.
 * Formato esperado por la extensión firestore-send-email.
 */
async function enqueueMail(
  db: admin.firestore.Firestore,
  payload: { to: string; subject: string; html: string; text?: string }
): Promise<void> {
  await db.collection(MAIL_COLLECTION).add({
    to: payload.to,
    message: {
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, ''),
    },
  });
}

export interface SendEmailEventParams {
  db: admin.firestore.Firestore;
  type: EmailEventType;
  playerId: string;
  schoolId: string;
  period: string;
  to: string;
  playerName: string;
  amount: number;
  currency: string;
  /** Para payment_receipt: fecha del pago */
  paidAt?: Date;
  /** Para payment_reminder_manual: link de pago Mercado Pago */
  checkoutUrl?: string;
  /** Nombre de la escuela (para personalizar el recordatorio) */
  schoolName?: string;
}

/**
 * Envía evento de email de forma idempotente.
 * Solo envía si no existe registro previo con el mismo idempotencyKey.
 */
export async function sendEmailEvent(params: SendEmailEventParams): Promise<boolean> {
  const { db, type, playerId, schoolId, period, to, playerName, amount, currency, paidAt, checkoutUrl, schoolName } = params;
  const key = idempotencyKey(type, playerId, period);

  if (await wasEmailSent(db, key)) {
    return false; // Ya enviado, skip
  }

  const amountStr = `${currency} ${amount.toLocaleString('es-AR')}`;
  const schoolNameSafe = schoolName ?? 'tu escuela';

  let subject: string;
  let contentHtml: string;

  switch (type) {
    case 'payment_reminder_manual':
      subject = `Recordatorio de pago - ${schoolNameSafe} - Regatas+`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Te recordamos desde ${escapeHtml(schoolNameSafe)} que tenés pendiente el pago del período <strong>${escapeHtml(period)}</strong> (${amountStr}).</p>
        <p>Por favor regularizá tu situación de pago lo antes posible.</p>
        ${checkoutUrl ? `<p><a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;margin:8px 0;">Pagar ahora</a></p>` : ''}
        <p>Si ya realizaste el pago, ignorá este mensaje.</p>
      `;
      break;
    case 'payment_receipt':
      subject = `Recibo de pago - Cuota ${period} - Escuelas River`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Confirmamos la recepción del pago correspondiente al período <strong>${period}</strong>.</p>
        <p><strong>Monto:</strong> ${amountStr}</p>
        <p><strong>Fecha de pago:</strong> ${paidAt ? paidAt.toLocaleDateString('es-AR') : '-'}</p>
        <p>Gracias por mantener tu cuota al día.</p>
      `;
      break;
    case 'delinquency_10_days':
      subject = `Aviso de mora - Cuota ${period} - Escuelas River`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Te recordamos que la cuota correspondiente al período <strong>${period}</strong> (${amountStr}) se encuentra en mora.</p>
        <p>Por favor regularizá tu situación de pago lo antes posible para continuar participando en las actividades.</p>
        <p>Si ya realizaste el pago, ignora este mensaje.</p>
      `;
      break;
    case 'suspension_30_days':
      subject = `Suspensión por mora - Cuota ${period} - Escuelas River`;
      contentHtml = `
        <p>Hola ${escapeHtml(playerName)},</p>
        <p>Informamos que por haber superado los 30 días de mora en la cuota del período <strong>${period}</strong> (${amountStr}), tu situación ha sido marcada como <strong>suspendido</strong>.</p>
        <p>Para regularizar: realizá el pago de la cuota adeudada. Una vez acreditado, tu estado se reactivará automáticamente.</p>
        <p>Si tenés dudas, contactá a la administración de tu escuela.</p>
      `;
      break;
    default: {
      const _: never = type;
      throw new Error(`Unknown email event type: ${String(_)}`);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://regatas-plus.vercel.app";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/LogoRiverNuevo_1_2.png`;

  const html = buildEmailHtml(contentHtml, {
    title: subject,
    greeting: `Estimado/a responsable de ${escapeHtml(playerName)}:`,
    logoUrl, // URL absoluta: Gmail/Outlook bloquean data: URI y adjuntos CID pueden fallar con Trigger Email
  });

  await enqueueMail(db, { to, subject, html });
  await recordEmailEvent(db, { type, playerId, schoolId, period, idempotencyKey: key });
  return true;
}
