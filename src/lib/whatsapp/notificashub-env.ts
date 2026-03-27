/**
 * Secreto compartido con NotificasHub (header x-internal-secret).
 * Preferir NOTIFICASHUB_INTERNAL_SECRET; INTERNAL_SECRET es alias compatible con .env.local legado.
 */
export function getNotificasHubInternalSecret(): string {
  const s =
    process.env.NOTIFICASHUB_INTERNAL_SECRET ?? process.env.INTERNAL_SECRET ?? '';
  return typeof s === 'string' ? s.trim() : '';
}
