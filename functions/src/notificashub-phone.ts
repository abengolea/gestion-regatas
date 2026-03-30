/**
 * Misma lógica que en src/lib/whatsapp/normalize-phone.ts (canonicalArgentineWhatsAppPhone).
 * Documento en NotificasHub: user_memberships/{este_id} debe coincidir con wa_id / register-user.
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

function normalizePhoneForNotificasHub(input: string | null | undefined): string {
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

/** ID de documento user_memberships en Firestore del hub (alineado a WhatsApp). */
export function canonicalPhoneForNotificasHubMembership(
  input: string | null | undefined
): string {
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
