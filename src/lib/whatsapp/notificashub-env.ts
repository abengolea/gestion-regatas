/**
 * Secreto compartido con NotificasHub (header x-internal-secret).
 * Preferir NOTIFICASHUB_INTERNAL_SECRET; INTERNAL_SECRET es alias compatible con .env.local legado.
 */
export function getNotificasHubInternalSecret(): string {
  const s =
    process.env.NOTIFICASHUB_INTERNAL_SECRET ?? process.env.INTERNAL_SECRET ?? '';
  return typeof s === 'string' ? s.trim() : '';
}

/**
 * ID del tenant Regatas en NotificasHub (documento `tenants/{id}` y body `register-user`).
 * Debe coincidir con el hub; si el webhook omite `tenantId`, se asume este valor.
 */
export function getNotificasHubTenantId(): string {
  const raw =
    process.env.NOTIFICASHUB_TENANT_ID ??
    process.env.NOTIFICASHUB_DEFAULT_TENANT_ID ??
    'regatas';
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'regatas';
}
