/**
 * Firebase Admin SDK - Solo para uso en servidor (API routes, server actions).
 * Credenciales: GOOGLE_APPLICATION_CREDENTIALS (local) o ADC (producción).
 */

import { App, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let adminApp: App;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is required for firebase-admin");
  }

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`;

  adminApp = initializeApp({
    projectId,
    storageBucket,
  });

  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

/** Alias para compatibilidad con código existente. */
export const getAdminFirestore = getAdminDb;

/** Storage Admin (para upload de imágenes, etc.). */
export function getAdminStorage() {
  return getStorage(getAdminApp());
}
