/**
 * Cloud Function: onSocioCreated
 * Cuando se da de alta un socio con celularPadre, registra la membresía
 * en NotificasHub para que el padre pueda recibir mensajes de Regatas+.
 *
 * Firestore del Hub: user_memberships/{phone_sanitized}
 * { phone, tenantIds: ["regatas"], updatedAt }
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { canonicalPhoneForNotificasHubMembership } from '../notificashub-phone';

/** Obtiene Firestore del Hub NotificasHub (proyecto distinto) */
function getHubFirestore(): admin.firestore.Firestore {
  const projectId = process.env.NOTIFICASHUB_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.NOTIFICASHUB_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.NOTIFICASHUB_FIREBASE_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n'
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'NotificasHub credentials not configured: NOTIFICASHUB_FIREBASE_*'
    );
  }

  const appName = 'notificashub';
  const existing = admin.apps.find((a) => a?.name === appName);
  if (existing) {
    return admin.firestore(existing as admin.app.App);
  }

  const hubApp = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    appName
  );
  return admin.firestore(hubApp);
}

export const onSocioCreated = onDocumentCreated(
  'subcomisiones/{subcomisionId}/socios/{socioId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const celular =
      data.tutorContact?.phone ?? data.telefono ?? data.celularPadre ?? '';
    const phone = canonicalPhoneForNotificasHubMembership(celular);
    if (!phone) {
      logger.debug(
        `onSocioCreated: socio ${event.params.socioId} sin celular válido, skip`
      );
      return;
    }

    try {
      const hubDb = getHubFirestore();
      const membershipRef = hubDb
        .collection('user_memberships')
        .doc(phone);

      const membershipSnap = await membershipRef.get();
      const now = admin.firestore.Timestamp.now();

      if (membershipSnap.exists) {
        const existing = membershipSnap.data();
        const tenantIds = (existing?.tenantIds ?? []) as string[];
        if (tenantIds.includes('regatas')) {
          logger.debug(`onSocioCreated: ${phone} ya tiene regatas`);
          return;
        }
        await membershipRef.update({
          tenantIds: admin.firestore.FieldValue.arrayUnion('regatas'),
          updatedAt: now,
        });
        logger.info(`onSocioCreated: agregado regatas a ${phone}`);
      } else {
        await membershipRef.set({
          phone,
          tenantIds: ['regatas'],
          updatedAt: now,
        });
        logger.info(`onSocioCreated: creado membership para ${phone}`);
      }
    } catch (e) {
      logger.error('onSocioCreated:', e);
      throw e;
    }
  }
);
