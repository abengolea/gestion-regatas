/**
 * POST /api/socios/update
 * Actualiza el documento de un jugador usando Admin SDK (evita reglas del cliente).
 * Autorizado si: el usuario es el jugador (su email coincide con updateData.email) o es staff de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";
import { syncNotificasHubFromPlayerDoc } from "@/lib/whatsapp/notificashub-register-user";

type UpdatePayload = {
  schoolId?: string;
  subcomisionId?: string;
  playerId?: string;
  socioId?: string;
  updateData: {
    firstName: string;
    lastName: string;
    birthDate: { seconds: number; nanoseconds: number } | ReturnType<Timestamp["toDate"]>;
    dni: string | null;
    healthInsurance: string | null;
    email: string | null;
    tutorContact: { name: string; phone: string };
    status: string;
    photoUrl: string | null;
    observations: string | null;
    altura_cm: number | null;
    peso_kg: number | null;
    mano_dominante: string | null;
    posicion_preferida: string | null;
    esSocio?: boolean;
  };
  oldEmail?: string | null;
};

function toFirestoreTimestamp(
  v: { seconds: number; nanoseconds: number } | Date | unknown
): Timestamp {
  if (v && typeof v === "object" && "seconds" in v && "nanoseconds" in v) {
    return new Timestamp((v as { seconds: number; nanoseconds: number }).seconds, (v as { seconds: number; nanoseconds: number }).nanoseconds);
  }
  if (v instanceof Date) {
    return Timestamp.fromDate(v);
  }
  return Timestamp.now();
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { uid, email: userEmail } = auth;
    if (!userEmail) {
      return NextResponse.json({ error: "Usuario sin email" }, { status: 403 });
    }

    const body = (await request.json()) as UpdatePayload;
    const schoolId = body.subcomisionId ?? body.schoolId;
    const playerId = body.socioId ?? body.playerId;
    const { updateData: raw, oldEmail } = body;
    if (!schoolId || !playerId || !raw) {
      return NextResponse.json({ error: "Faltan schoolId, playerId o updateData" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Autorización: jugador (email en updateData coincide) o staff (está en subcomisiones/schoolId/users)
    const isPlayerSelf =
      raw.email != null &&
      raw.email.trim().toLowerCase() === userEmail.trim().toLowerCase();
    const userInSchool = await db
      .collection('subcomisiones')
      .doc(schoolId)
      .collection('users')
      .doc(uid)
      .get()
      .then((s) => s.exists);

    if (!isPlayerSelf && !userInSchool) {
      return NextResponse.json(
        { error: "No tenés permiso para actualizar este jugador" },
        { status: 403 }
      );
    }

    const birthDate = raw.birthDate
      ? toFirestoreTimestamp(raw.birthDate)
      : Timestamp.now();

    const updateData = {
      ...raw,
      birthDate,
    };

    const playerRef = db.collection('subcomisiones').doc(schoolId).collection('socios').doc(playerId);
    const prevSnap = await playerRef.get();
    const prevData = prevSnap.exists ? prevSnap.data() : undefined;

    await playerRef.update(updateData);

    void syncNotificasHubFromPlayerDoc(
      prevData as { tutorContact?: { phone?: string }; telefono?: string; celularPadre?: string } | undefined,
      raw.tutorContact?.phone ?? ""
    ).catch((e) => console.error("[players/update] NotificasHub sync", e));

    const newEmailNorm = raw.email?.trim().toLowerCase() || null;
    const oldEmailNorm = oldEmail?.trim().toLowerCase() || null;

    if (newEmailNorm) {
      await db.doc(`socioLogins/${newEmailNorm}`).set({
        subcomisionId: schoolId,
        socioId: playerId,
        schoolId,
        playerId,
      });
    }
    if (oldEmailNorm && oldEmailNorm !== newEmailNorm) {
      await db.doc(`playerLogins/${oldEmailNorm}`).delete();
    } else if (!newEmailNorm && oldEmailNorm) {
      await db.doc(`playerLogins/${oldEmailNorm}`).delete();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/update POST]", e);
    return NextResponse.json(
      { error: "Error al actualizar el jugador", detail: message },
      { status: 500 }
    );
  }
}
