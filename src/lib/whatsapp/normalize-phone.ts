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
