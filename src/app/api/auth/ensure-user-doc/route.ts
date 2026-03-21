/**
 * POST /api/auth/ensure-user-doc
 * Asegura que el usuario tenga un doc en subcomisiones/{schoolId}/users/{uid}
 * para que las reglas de Firestore le permitan listar socios.
 * Se llama al cargar la página de jugadores si el usuario es staff.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth?.uid) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { schoolId?: string };
    const schoolId = body.schoolId ?? body.subcomisionId;
    if (!schoolId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const db = getAdminFirestore();
    const uid = auth.uid;
    const emailNorm = (auth.email ?? "").trim().toLowerCase();

    const existing = await db
      .collection("subcomisiones")
      .doc(schoolId)
      .collection("users")
      .doc(uid)
      .get();

    if (existing.exists) {
      return NextResponse.json({ ok: true, created: false });
    }

    const [usersSub, usersSchool] = await Promise.all([
      db.collection("subcomisiones").doc(schoolId).collection("users").get(),
      db.collection("schools").doc(schoolId).collection("users").get(),
    ]);
    const allDocs = [...usersSub.docs, ...usersSchool.docs];
    const match = allDocs.find(
      (d) => (d.data() as { email?: string }).email?.toLowerCase() === emailNorm
    );

    if (!match) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const data = match.data() as { role?: string; displayName?: string };
    const role = data.role ?? "";
    if (!["admin_subcomision", "encargado_deportivo", "editor", "viewer"].includes(role)) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    await db.collection("subcomisiones").doc(schoolId).collection("users").doc(uid).set(
      {
        role,
        email: emailNorm,
        displayName: data.displayName ?? auth.displayName ?? auth.email ?? emailNorm,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, created: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
