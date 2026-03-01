/**
 * Script para crear el usuario super administrador en Firebase Auth y Firestore.
 *
 * Uso:
 *   1. Descargar clave de cuenta de servicio desde Firebase Console → Configuración → Cuentas de servicio.
 *   2. Definir GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON (o poner service-account.json en la raíz).
 *   3. npm run seed:super-admin   (o npx tsx scripts/create-super-admin.ts)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import * as fs from 'fs';
import * as admin from 'firebase-admin';

const SUPER_ADMIN_EMAIL = 'abengolea1@gmail.com';
const SUPER_ADMIN_PASSWORD = 'abengolea1@gmail.com';

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
          displayName: 'Super Admin',
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
