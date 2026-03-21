/**
 * POST /api/registrations/on-approve
 * Envía por sistema el email "Fuiste aceptado" al jugador recién aprobado.
 * Solo admin o encargado_deportivo de la escuela puede llamar.
 * Escribe en la colección `mail` para que la extensión Trigger Email (firestore-send-email) envíe el correo.
 * Usa plantilla con logo (email-template-server).
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import {
  buildEmailHtmlServer,
  LOGO_ATTACHMENT_SERVER,
} from "@/lib/email-template-server";

const MAIL_COLLECTION = "mail";

const bodySchema = {
  schoolId: (v: unknown) => typeof v === "string" && (v as string).length > 0,
  subcomisionId: (v: unknown) => typeof v === "string" && (v as string).length > 0,
  playerId: (v: unknown) => typeof v === "string" && (v as string).length > 0,
  socioId: (v: unknown) => typeof v === "string" && (v as string).length > 0,
  playerEmail: (v: unknown) => typeof v === "string" && (v as string).includes("@"),
};

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const schoolId = (body.subcomisionId ?? body.schoolId) as string;
    const playerId = (body.socioId ?? body.playerId) as string;
    if (
      !bodySchema.schoolId(schoolId) ||
      !bodySchema.playerId(playerId) ||
      !bodySchema.playerEmail(body.playerEmail)
    ) {
      return NextResponse.json(
        { error: "Faltan schoolId, playerId o playerEmail" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // Verificar que el usuario sea admin o encargado_deportivo de la escuela
    const schoolUserSnap = await db
      .collection("subcomisiones")
      .doc(schoolId)
      .collection("users")
      .doc(auth.uid)
      .get();

    if (!schoolUserSnap.exists) {
      return NextResponse.json(
        { error: "No tenés permiso para aprobar en esta escuela" },
        { status: 403 }
      );
    }

    const role = schoolUserSnap.data()?.role;
    if (role !== "admin_subcomision" && role !== "encargado_deportivo") {
      return NextResponse.json(
        { error: "Solo admin o entrenador puede aprobar solicitudes" },
        { status: 403 }
      );
    }

    const to = (body.playerEmail as string).trim().toLowerCase();
    const subject = "Fuiste aceptado - Regatas+";
    const contentHtml = `
      <p>Tu solicitud de registro fue <strong>aceptada</strong>.</p>
      <p>Ya podés ingresar al panel con tu email y la contraseña que elegiste al registrarte.</p>
      <p>Si olvidaste tu contraseña, en la pantalla de inicio de sesión usá <strong>Olvidé mi contraseña</strong> para restablecerla.</p>
    `;
    const html = buildEmailHtmlServer(contentHtml, {
      title: subject,
      greeting: "Hola,",
    });
    const text = "Tu solicitud de registro fue aceptada. Ya podés ingresar al panel con tu email y la contraseña que elegiste. Si olvidaste tu contraseña, usá Olvidé mi contraseña en la pantalla de inicio de sesión.";

    // Formato esperado por la extensión Trigger Email (firestore-send-email), con adjunto del logo
    await db.collection(MAIL_COLLECTION).add({
      to,
      message: {
        subject,
        html,
        text,
        attachments: [LOGO_ATTACHMENT_SERVER],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[registrations/on-approve]", e);
    return NextResponse.json(
      { error: "Error al enviar el email de aceptación", detail: message },
      { status: 500 }
    );
  }
}
