/**
 * Prueba de normalización de celular (NotificasHub / WhatsApp vs ficha).
 * Uso: npx tsx scripts/debug-whatsapp-phone.ts [número]
 * Ej.: npx tsx scripts/debug-whatsapp-phone.ts 3364645357
 *
 * Escaneo Firestore (opcional): definí GOOGLE_APPLICATION_CREDENTIALS y tené .env.local
 * con NEXT_PUBLIC_FIREBASE_PROJECT_ID; ejecuta con --scan
 *   npx tsx scripts/debug-whatsapp-phone.ts 3364645357 --scan
 */

import { config } from 'dotenv';
import {
  canonicalArgentineWhatsAppPhone,
  normalizePhoneForNotificasHub,
  normalizeArgentinePhone,
} from '../src/lib/whatsapp/normalize-phone';

config({ path: '.env.local' });

const args = process.argv.slice(2).filter((a) => a !== '--scan');
const doScan = process.argv.includes('--scan');
const raw = args[0] ?? '3364645357';

const variants = new Set<string>([
  raw,
  `+54${raw}`,
  `54${raw}`,
  `549${raw}`,
  `0${raw}`,
  `+54 9 ${raw.slice(0, 3)} ${raw.slice(3)}`,
  `${raw}@c.us`,
  `54${raw}@s.whatsapp.net`,
]);

for (const v of variants) {
  const hub = normalizePhoneForNotificasHub(v);
  const legacy = normalizeArgentinePhone(v);
  const canon = canonicalArgentineWhatsAppPhone(v);
  console.log(
    JSON.stringify({
      input: v,
      normalizePhoneForNotificasHub: hub,
      normalizeArgentinePhone: legacy,
      canonicalArgentineWhatsAppPhone: canon,
    })
  );
}

const winner = canonicalArgentineWhatsAppPhone(raw);
console.log('\n--- Resumen ---');
console.log(
  'Canonical (Firestore tutor vs wa_id hub):',
  winner || '(vacío: número inválido para las reglas actuales)'
);

void (async () => {
  if (doScan && winner) {
    console.log('\n--- Firestore: socios con mismo tel (tutorContact / telefono / celularPadre) ---');
    const { getAdminFirestore } = await import('../src/lib/firebase-admin');
    const db = getAdminFirestore();
    const phoneNorm = canonicalArgentineWhatsAppPhone(winner);
    const subs = await db.collection('subcomisiones').get();
    let found = 0;
    for (const subDoc of subs.docs) {
      const socios = await db
        .collection('subcomisiones')
        .doc(subDoc.id)
        .collection('socios')
        .get();
      for (const s of socios.docs) {
        const d = s.data() as {
          tutorContact?: { phone?: string };
          telefono?: string;
          celularPadre?: string;
          firstName?: string;
          lastName?: string;
        };
        const tutorPhone = d.tutorContact?.phone ?? d.telefono ?? d.celularPadre ?? '';
        if (canonicalArgentineWhatsAppPhone(tutorPhone) === phoneNorm) {
          found++;
          console.log(
            JSON.stringify({
              subcomisionId: subDoc.id,
              socioId: s.id,
              rawTutorPhone: tutorPhone,
              canonical: canonicalArgentineWhatsAppPhone(tutorPhone),
              nombre: [d.lastName, d.firstName].filter(Boolean).join(', '),
            })
          );
        }
      }
    }
    if (found === 0) {
      console.log(
        'Ningún documento coincide. Revisá en consola Firebase el valor guardado en tutorContact.phone (cualquier formato).'
      );
    }
  } else if (doScan && !winner) {
    console.log('Saltando scan: canonical vacío.');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
