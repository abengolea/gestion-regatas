/**
 * Handler de mensajes WhatsApp entrantes desde NotificasHub.
 * Regatas+ — Identificación de padre + procesamiento de comprobantes.
 */

import * as admin from 'firebase-admin';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase-admin';

type Firestore = admin.firestore.Firestore;
type DocRef = admin.firestore.DocumentReference;
import { NotificasHubClient } from './NotificasHubClient';
import { normalizeArgentinePhone } from './normalize-phone';

export interface NotificasHubPayload {
  phone: string;
  tenantId: string;
  message: {
    type: 'image' | 'text';
    imageUrl?: string;
    text?: string;
  };
  waMessageId: string;
}

const SESSION_TTL_MINUTES = 30;

export class WhatsAppBotHandler {
  static async handle(payload: NotificasHubPayload): Promise<void> {
    const phone = normalizeArgentinePhone(payload.phone);
    if (!phone) return;

    const db = getAdminFirestore();
    const sessionRef = db.collection('wa_sessions_regatas').doc(phone);

    if (payload.message.type === 'image') {
      await this.handleImage(db, sessionRef, phone, payload);
    } else if (payload.message.type === 'text') {
      await this.handleText(db, sessionRef, phone, payload.message.text ?? '');
    }
  }

  private static async handleImage(
    db: Firestore,
    sessionRef: DocRef,
    phone: string,
    payload: NotificasHubPayload
  ): Promise<void> {
    const imageUrl = payload.message.imageUrl;
    if (!imageUrl) return;

    const sociosConEsteCelular = await this.buscarSociosPorCelular(db, phone);

    if (sociosConEsteCelular.length === 0) {
      await sessionRef.set({
        phone,
        estado: 'esperando_dni',
        imagenUrl: imageUrl,
        expiraEn: this.expiraEn(),
      });
      await NotificasHubClient.sendText(
        phone,
        'No encontramos tu número registrado. Enviá el DNI del jugador/a para identificar la cuenta.'
      );
      return;
    }

    const viajesPendientes = await this.obtenerViajesPendientes(db, sociosConEsteCelular);

    if (viajesPendientes.length === 0) {
      await NotificasHubClient.sendText(
        phone,
        'No encontramos viajes pendientes de pago para tu hijo/a.'
      );
      return;
    }

    if (viajesPendientes.length === 1) {
      const { viajeId, socioId, viaje } = viajesPendientes[0];
      const comprobanteUrl = await this.guardarComprobante(phone, viajeId, socioId, imageUrl);
      if (!comprobanteUrl) {
        await NotificasHubClient.sendText(
          phone,
          'Hubo un error al guardar el comprobante. Intentá de nuevo.'
        );
        return;
      }

      const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
      const admin = await import('firebase-admin');
      await pagoRef.set(
        {
          estado: 'en_revision',
          comprobanteFuente: 'whatsapp',
          comprobanteUrl,
          celularPagador: phone,
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );

      await NotificasHubClient.sendText(
        phone,
        `Recibimos el comprobante para ${viaje.destino}. Lo estamos revisando y te avisamos pronto.`
      );
      await sessionRef.delete();
      return;
    }

    await sessionRef.set({
      phone,
      estado: 'esperando_seleccion_viaje',
      viajesDisponibles: viajesPendientes.map((v) => v.viajeId),
      imagenUrl: imageUrl,
      expiraEn: this.expiraEn(),
    });
    const lista = viajesPendientes
      .map((v, i) => `${i + 1}. ${v.viaje.destino} — ${v.viaje.precioPorJugador} ARS`)
      .join('\n');
    await NotificasHubClient.sendText(
      phone,
      `Tenés más de un viaje pendiente. ¿Cuál corresponde a este comprobante?\n\n${lista}\n\nRespondé con el número (1, 2, etc.)`
    );
  }

  private static async handleText(
    db: Firestore,
    sessionRef: DocRef,
    phone: string,
    text: string
  ): Promise<void> {
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data();

    if (!session) return;

    if (session.estado === 'esperando_dni') {
      const dni = text.trim().replace(/\D/g, '');
      if (dni.length < 7) {
        await NotificasHubClient.sendText(phone, 'El DNI ingresado parece incorrecto. Intentá de nuevo.');
        return;
      }
      const socio = await this.buscarSocioPorDni(db, dni);
      if (!socio) {
        await NotificasHubClient.sendText(
          phone,
          'No encontramos un jugador/a con ese DNI. Verificá el número e intentá de nuevo.'
        );
        return;
      }
      await sessionRef.delete();
      if (session.imagenUrl) {
        const viajesPendientes = await this.obtenerViajesPendientes(db, [socio]);
        if (viajesPendientes.length === 1) {
          const { viajeId, socioId, viaje } = viajesPendientes[0];
          const comprobanteUrl = await this.guardarComprobante(phone, viajeId, socioId, session.imagenUrl);
          if (comprobanteUrl) {
            const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
            const admin = await import('firebase-admin');
            await pagoRef.set(
              {
                estado: 'en_revision',
                comprobanteFuente: 'whatsapp',
                comprobanteUrl,
                celularPagador: phone,
                updatedAt: admin.firestore.Timestamp.now(),
              },
              { merge: true }
            );
          }
          await NotificasHubClient.sendText(
            phone,
            `Recibimos el comprobante para ${viaje.destino}. Lo estamos revisando.`
          );
        } else if (viajesPendientes.length > 1) {
          await sessionRef.set({
            phone,
            estado: 'esperando_seleccion_viaje',
            viajesDisponibles: viajesPendientes.map((v) => v.viajeId),
            imagenUrl: session.imagenUrl,
            expiraEn: this.expiraEn(),
          });
          const lista = viajesPendientes
            .map((v, i) => `${i + 1}. ${v.viaje.destino}`)
            .join('\n');
          await NotificasHubClient.sendText(
            phone,
            `Tenés más de un viaje pendiente. ¿Cuál corresponde?\n\n${lista}`
          );
        }
      }
      return;
    }

    if (session.estado === 'esperando_seleccion_viaje') {
      const idx = parseInt(text.trim(), 10);
      const viajesIds = session.viajesDisponibles ?? [];
      if (idx < 1 || idx > viajesIds.length) {
        await NotificasHubClient.sendText(phone, 'Número inválido. Respondé con 1, 2, etc.');
        return;
      }
      const viajeId = viajesIds[idx - 1];
      const viajeSnap = await db.collection('viajes').doc(viajeId).get();
      if (!viajeSnap.exists) {
        await NotificasHubClient.sendText(phone, 'Hubo un error. Intentá de nuevo.');
        return;
      }
      const socioId = await this.obtenerSocioIdDeViaje(db, viajeId, phone);
      if (!socioId || !session.imagenUrl) {
        await NotificasHubClient.sendText(phone, 'Hubo un error al procesar.');
        return;
      }
      const comprobanteUrl = await this.guardarComprobante(phone, viajeId, socioId, session.imagenUrl);
      if (comprobanteUrl) {
        const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
        const admin = await import('firebase-admin');
        await pagoRef.set(
          {
            estado: 'en_revision',
            comprobanteFuente: 'whatsapp',
            comprobanteUrl,
            celularPagador: phone,
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true }
        );
      }
      const viajeData = viajeSnap.data()!;
      await NotificasHubClient.sendText(
        phone,
        `Recibimos el comprobante para ${viajeData.destino}. Lo estamos revisando.`
      );
      await sessionRef.delete();
    }
  }

  private static async buscarSociosPorCelular(
    db: Firestore,
    phone: string
  ): Promise<Array<{ subcomisionId: string; socioId: string }>> {
    const subcomisionesSnap = await db.collection('subcomisiones').get();
    const socios: Array<{ subcomisionId: string; socioId: string }> = [];
    const phoneNorm = normalizeArgentinePhone(phone);

    for (const subDoc of subcomisionesSnap.docs) {
      const sociosSnap = await db
        .collection('subcomisiones')
        .doc(subDoc.id)
        .collection('socios')
        .get();

      for (const s of sociosSnap.docs) {
        const d = s.data();
        const tutorPhone = d.tutorContact?.phone ?? d.telefono ?? d.celularPadre ?? '';
        if (normalizeArgentinePhone(tutorPhone) === phoneNorm) {
          socios.push({ subcomisionId: subDoc.id, socioId: s.id });
        }
      }
    }
    return socios;
  }

  private static async buscarSocioPorDni(
    db: Firestore,
    dni: string
  ): Promise<{ subcomisionId: string; socioId: string } | null> {
    const subcomisionesSnap = await db.collection('subcomisiones').get();
    for (const subDoc of subcomisionesSnap.docs) {
      const byDni = await db
        .collection('subcomisiones')
        .doc(subDoc.id)
        .collection('socios')
        .where('dni', '==', dni)
        .limit(1)
        .get();
      if (!byDni.empty) {
        return { subcomisionId: subDoc.id, socioId: byDni.docs[0].id };
      }
    }
    return null;
  }

  private static async obtenerViajesPendientes(
    db: Firestore,
    socios: Array<{ subcomisionId: string; socioId: string }>
  ): Promise<
    Array<{
      viajeId: string;
      socioId: string;
      viaje: { destino: string; precioPorJugador: number };
    }>
  > {
    const viajesSnap = await db
      .collection('viajes')
    .where('estado', '==', 'abierto')
    .get();

    const resultados: Array<{
      viajeId: string;
      socioId: string;
      viaje: { destino: string; precioPorJugador: number };
    }> = [];

    for (const v of viajesSnap.docs) {
      const data = v.data();
      const designados = (data.jugadoresDesignados ?? []) as string[];
      for (const s of socios) {
        if (designados.includes(s.socioId)) {
          const pagoSnap = await db
            .collection('viajes')
            .doc(v.id)
            .collection('pagos')
            .doc(s.socioId)
            .get();
          const pagoData = pagoSnap.data();
          const estado = pagoData?.estado ?? 'pendiente';
          if (estado === 'pendiente' || estado === 'en_revision') {
            resultados.push({
              viajeId: v.id,
              socioId: s.socioId,
              viaje: {
                destino: data.destino ?? '',
                precioPorJugador: Math.round(data.precioPorJugador ?? 0),
              },
            });
          }
        }
      }
    }
    return resultados;
  }

  private static async obtenerSocioIdDeViaje(
    db: Firestore,
    viajeId: string,
    phone: string
  ): Promise<string | null> {
    const socios = await this.buscarSociosPorCelular(db, phone);
    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    const designados = (viajeSnap.data()?.jugadoresDesignados ?? []) as string[];
    for (const s of socios) {
      if (designados.includes(s.socioId)) return s.socioId;
    }
    return null;
  }

  private static async guardarComprobante(
    _phone: string,
    viajeId: string,
    socioId: string,
    imageUrl: string
  ): Promise<string | null> {
    try {
      const res = await fetch(imageUrl);
      const buffer = await res.arrayBuffer();
      const storage = getAdminStorage();
      const bucket = storage.bucket();
      const ts = Date.now();
      const path = `comprobantes/${viajeId}/${socioId}/${ts}.jpg`;
      const file = bucket.file(path);
      await file.save(Buffer.from(buffer), {
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/${path}`;
    } catch (e) {
      console.error('[WhatsAppBotHandler] guardarComprobante:', e);
      return null;
    }
  }

  private static expiraEn(): admin.firestore.Timestamp {
    const d = new Date();
    d.setMinutes(d.getMinutes() + SESSION_TTL_MINUTES);
    return admin.firestore.Timestamp.fromDate(d);
  }
}
