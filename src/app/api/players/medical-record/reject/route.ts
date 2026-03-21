/**
 * POST /api/socios/medical-record/reject
 * Marca la ficha médica como incumplida (rejectedAt, rejectedBy, rejectionReason).
 * Solo administrador o entrenador de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const b = body as { schoolId?: string; subcomisionId?: string; playerId?: string; socioId?: string; rejectionReason?: string };
    const schoolId = b.subcomisionId ?? b.schoolId;
    const playerId = b.socioId ?? b.playerId;
    const { rejectionReason } = b;
    if (!schoolId || !playerId) {
      return NextResponse.json(
        { error: "Faltan schoolId o playerId" },
        { status: 400 }
      );
    }
    const reason = (rejectionReason ?? "").trim();
    if (!reason) {
      return NextResponse.json(
        { error: "Debés indicar el motivo del rechazo para que el jugador sepa qué corregir." },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;

    const schoolUserSnap = await db.collection('subcomisiones').doc(schoolId).collection('users').doc(uid).get();
    const schoolUserData = schoolUserSnap.data() as { role?: string } | undefined;
    const isStaff =
      schoolUserSnap.exists &&
      (schoolUserData?.role === "admin_subcomision" || schoolUserData?.role === "encargado_deportivo");
    const platformSnap = await db.doc(`platformUsers/${uid}`).get();
    const platformData = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSuperAdmin =
      platformSnap.exists &&
      (platformData?.gerente_club ?? platformData?.super_admin) === true;

    if (!isStaff && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Solo el administrador o entrenador puede marcar la ficha como incumplida" },
        { status: 403 }
      );
    }

    const playerRef = db.collection('subcomisiones').doc(schoolId).collection('socios').doc(playerId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const data = playerSnap.data() as {
      medicalRecord?: { url?: string; storagePath?: string; uploadedAt?: unknown; uploadedBy?: string };
    };
    const current = data?.medicalRecord;
    if (!current?.url) {
      return NextResponse.json(
        { error: "Este jugador aún no tiene una ficha médica cargada" },
        { status: 400 }
      );
    }

    // Objeto solo con los campos válidos (sin approvedAt/approvedBy para limpiar aprobación previa)
    const medicalRecord = {
      url: current.url,
      ...(current.storagePath != null && { storagePath: current.storagePath }),
      ...(current.uploadedAt != null && { uploadedAt: current.uploadedAt }),
      ...(current.uploadedBy != null && { uploadedBy: current.uploadedBy }),
      rejectedAt: Timestamp.now(),
      rejectedBy: uid,
      rejectionReason: reason,
    };

    await playerRef.update({ medicalRecord });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/medical-record/reject POST]", e);
    return NextResponse.json(
      { error: "Error al marcar ficha como incumplida", detail: message },
      { status: 500 }
    );
  }
}
