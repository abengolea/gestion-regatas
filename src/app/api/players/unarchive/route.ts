/**
 * POST /api/socios/unarchive
 * Desarchiva un jugador (vuelve a aparecer en listados y suma en totales).
 * Solo administrador de la escuela o super admin.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const b = body as { schoolId?: string; subcomisionId?: string; playerId?: string; socioId?: string };
    const schoolId = b.subcomisionId ?? b.schoolId;
    const playerId = b.socioId ?? b.playerId;
    if (!schoolId || !playerId) {
      return NextResponse.json(
        { error: "Faltan schoolId o playerId" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;

    const schoolUserSnap = await db
      .collection('subcomisiones')
      .doc(schoolId)
      .collection('users')
      .doc(uid)
      .get();
    const platformUserSnap = await db.doc(`platformUsers/${uid}`).get();
    const isSubcomisionAdmin =
      schoolUserSnap.exists &&
      (schoolUserSnap.data() as { role?: string })?.role === "admin_subcomision";
    const platformData = platformUserSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSuperAdmin =
      platformUserSnap.exists &&
      (platformData?.gerente_club ?? platformData?.super_admin) === true;

    if (!isSubcomisionAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Solo el administrador de la escuela puede desarchivar jugadores" },
        { status: 403 }
      );
    }

    const playerRef = db.collection('subcomisiones').doc(schoolId).collection('socios').doc(playerId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      return NextResponse.json(
        { error: "Jugador no encontrado en esta escuela" },
        { status: 404 }
      );
    }

    await playerRef.update({
      archived: false,
      archivedAt: FieldValue.delete(),
      archivedBy: FieldValue.delete(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/unarchive POST]", e);
    return NextResponse.json(
      { error: "Error al desarchivar el jugador", detail: message },
      { status: 500 }
    );
  }
}
