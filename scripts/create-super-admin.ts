/**
 * Script para crear el usuario super administrador en Firebase Auth y Firestore.
 *
 * Uso:
 *   1. Descargar clave de cuenta de servicio desde Firebase Console → Configuración → Cuentas de servicio.
 *   2. Definir GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON (o poner service-account.json en la raíz).
 *   3. Ejecutar:
 *        npm run seed:super-admin
 *        npx tsx scripts/create-super-admin.ts [email] [contraseña]
 *        npx tsx scripts/create-super-admin.ts mi@email.com mipassword123
 *
 *   También podés usar variables de entorno: SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import * as fs from 'fs';
import * as admin from 'firebase-admin';

// Prioridad: argumentos CLI > variables de entorno > valores por defecto
const args = process.argv.slice(2);
const SUPER_ADMIN_EMAIL = args[0] ?? process.env.SUPER_ADMIN_EMAIL ?? 'abengolea1@gmail.com';
const SUPER_ADMIN_PASSWORD = args[1] ?? process.env.SUPER_ADMIN_PASSWORD ?? 'ofure9784';

const projectId =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function resolveCredentialsPath(): string {
  const cwd = process.cwd();
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath) {
    const absolute = path.isAbsolute(envPath) ? envPath : path.join(cwd, envPath);
    if (fs.existsSync(absolute)) return absolute;
  }
  const candidates = [
    path.join(cwd, 'service-account.json'),
    path.join(cwd, 'service-account.json.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function initFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const credentialsPath = resolveCredentialsPath();
  if (!credentialsPath) {
    console.error(
      'No se encontró el archivo de la cuenta de servicio.\n' +
        'Poné service-account.json en la carpeta del proyecto o definí GOOGLE_APPLICATION_CREDENTIALS.'
    );
    process.exit(1);
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  return admin.initializeApp({
    projectId: projectId || undefined,
    credential: admin.credential.applicationDefault(),
  });
}

async function main() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.error('Error: Se requiere email y contraseña.');
    console.error('Uso: npx tsx scripts/create-super-admin.ts <email> <contraseña>');
    process.exit(1);
  }
  if (SUPER_ADMIN_PASSWORD.length < 6) {
    console.error('Error: La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const app = initFirebaseAdmin();
  const auth = admin.auth(app);
  const db = admin.firestore(app);

  try {
    let userRecord: admin.auth.UserRecord;

    try {
      userRecord = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      console.log(`✓ Usuario ya existe en Auth: ${SUPER_ADMIN_EMAIL} (uid: ${userRecord.uid})`);
      await auth.updateUser(userRecord.uid, { password: SUPER_ADMIN_PASSWORD });
      console.log('✓ Contraseña actualizada.');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
          emailVerified: true,
          displayName: 'Gerente del Club',
        });
        console.log(`✓ Usuario creado en Auth: ${SUPER_ADMIN_EMAIL} (uid: ${userRecord.uid})`);
      } else {
        throw err;
      }
    }

    const platformUserRef = db.collection('platformUsers').doc(userRecord.uid);
    await platformUserRef.set(
      {
        email: SUPER_ADMIN_EMAIL,
        gerente_club: true,
        super_admin: true,
        createdAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
    console.log('✓ Documento platformUsers creado/actualizado con super_admin: true');

    console.log('\n--- Super Admin listo ---');
    console.log(`Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`Contraseña: ${SUPER_ADMIN_PASSWORD}`);
    console.log('\nPodés iniciar sesión en /auth/login');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
