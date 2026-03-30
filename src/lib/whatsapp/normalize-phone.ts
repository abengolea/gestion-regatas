/**
 * Normalización de celulares argentinos.
 * Regatas+ — Integración NotificasHub
 */

/**
 * Normaliza un número de celular argentino al formato internacional.
 * - Sacar: +, espacios, guiones, paréntesis
 * - Si empieza con 0 → reemplazar por 54
 * - CABA: 011 15-XXXX-XXXX → 5491115XXXXXXX
 * - Interior: 0336 4XXXXXX → 54336XXXXXXX
 * - Resultado: 12-13 dígitos (54 + 9/10 dígitos)
 */
export function normalizeArgentinePhone(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';

  let s = input.replace(/[\s\-\(\)\+]/g, '');

  if (s.startsWith('0')) {
    s = '54' + s.slice(1);
  } else if (!s.startsWith('54')) {
    s = '54' + s;
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 13) return '';

  return digits;
}

/**
 * Valida que el resultado sea un celular argentino válido.
 */
export function isValidArgentinePhone(phone: string): boolean {
  const normalized = normalizeArgentinePhone(phone);
  if (!normalized) return false;
  if (normalized.length < 12 || normalized.length > 13) return false;
  if (!normalized.startsWith('54')) return false;
  return true;
}

/**
 * Teléfono solo dígitos, consistente con envío a NotificasHub / wa_id (AR).
 * - Usa `normalizeArgentinePhone` cuando el valor ya incluye 54 o formato local con 0.
 * - Si hay 10 dígitos sin código país (típico móvil), antepone 549.
 */
export function normalizePhoneForNotificasHub(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw || raw === '—' || raw === '-') return '';

  const onlyDigits = raw.replace(/\D/g, '');
  if (!onlyDigits) return '';

  let candidate: string;
  if (onlyDigits.startsWith('54')) {
    candidate = raw;
  } else if (onlyDigits.length === 10) {
    candidate = `549${onlyDigits}`;
  } else if (onlyDigits.length === 11 && onlyDigits.startsWith('9')) {
    candidate = `54${onlyDigits}`;
  } else {
    candidate = raw;
  }

  const normalized = normalizeArgentinePhone(candidate);
  if (normalized) return normalized;

  if (onlyDigits.startsWith('54') && onlyDigits.length >= 12 && onlyDigits.length <= 13) {
    return onlyDigits;
  }
  return '';
}

/**
 * Formato unificado para comparar el wa_id de WhatsApp con teléfonos guardados en fichas.
 * WhatsApp/NotificasHub suelen usar 549… (móvil); números cargados como 11… o 54 11… sin el 9
 * fallaban al compararse con {@link normalizeArgentinePhone} solo (generaba 5411… vs 54911…).
 */
export function canonicalArgentineWhatsAppPhone(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';

  const fromHub = normalizePhoneForNotificasHub(input.trim());
  let digits = fromHub || normalizeArgentinePhone(input.trim());

  if (!digits) {
    const only = input.replace(/\D/g, '');
    if (only.length >= 12 && only.length <= 13 && only.startsWith('54')) {
      digits = only;
    } else {
      return '';
    }
  }

  if (digits.length === 12 && digits.startsWith('54') && digits[2] !== '9') {
    return `549${digits.slice(2)}`;
  }

  return digits;
}
