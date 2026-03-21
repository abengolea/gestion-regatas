/**
 * POST /api/players/bulk-import
 * Importa jugadores masivamente desde Excel (.xlsx, .xls, .csv) o PDF.
 * Solo administrador o entrenador de la escuela. Los datos se guardan en subcomisiones/{schoolId}/socios.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";
import * as XLSX from "xlsx";

const EXCEL_COLUMN_ALIASES: Record<string, string[]> = {
  nombre: ["nombre", "Nombre", "NOMBRE", "nombre_socio", "Nombres", "firstName", "first_name"],
  apellido: ["apellido", "Apellido", "APELLIDO", "apellidos", "Apellidos", "lastName", "last_name"],
  email: ["email", "Email", "EMAIL", "mail", "correo", "Correo"],
  dni: ["dni", "DNI", "documento", "Documento", "cedula"],
  telefono: ["telefono", "Telefono", "teléfono", "celular", "Celular", "phone"],
  tutorNombre: ["tutor_nombre", "tutorNombre", "tutor", "Tutor", "nombre_tutor", "contacto"],
  tutorTelefono: ["tutor_telefono", "tutorTelefono", "telefono_tutor", "celular_tutor"],
  fechaNacimiento: ["fecha_nacimiento", "fechaNacimiento", "nacimiento", "birthDate", "birth_date", "fecha nacimiento"],
  edad: ["edad", "Edad", "EDAD", "age", "Age"],
  obraSocial: ["obra_social", "obraSocial", "healthInsurance", "obra social"],
};

function findColumnValue(row: Record<string, unknown>, field: keyof typeof EXCEL_COLUMN_ALIASES): string {
  const aliases = EXCEL_COLUMN_ALIASES[field];
  for (const alias of aliases) {
    const val = row[alias];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return "";
}

function parseExcelOrCsv(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;\t]/).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function parsePdf(buffer: Buffer): Promise<Record<string, unknown>[]> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = typeof data === "object" && data && "text" in data ? String((data as { text: string }).text) : "";
    if (!text.trim()) return [];
    return parseCsvText(text);
  } catch {
    return [];
  }
}

function parseDate(str: string): Date | null {
  if (!str?.trim()) return null;
  const s = str.trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const match = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const d2 = new Date(parseInt(year!, 10), parseInt(month!, 10) - 1, parseInt(day!, 10));
    if (!isNaN(d2.getTime())) return d2;
  }
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
  }
  return null;
}

/** Calcula fecha de nacimiento aproximada a partir de la edad (años). */
function birthDateFromAge(ageYears: number): Date | null {
  const n = parseInt(String(ageYears), 10);
  if (isNaN(n) || n < 0 || n > 120) return null;
  const today = new Date();
  return new Date(today.getFullYear() - n, today.getMonth(), today.getDate());
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const schoolId = (formData.get("schoolId") as string) ?? (formData.get("subcomisionId") as string);
    const categoriaId = (formData.get("categoriaId") as string)?.trim() || null;
    if (!file || !schoolId) {
      return NextResponse.json(
        { error: "Faltan archivo (file) o schoolId/subcomisionId" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;
    const emailNorm = (auth.email ?? "").trim().toLowerCase();

    const subcomisionUserSnap = await db
      .collection("subcomisiones")
      .doc(schoolId)
      .collection("users")
      .doc(uid)
      .get();
    const schoolsUserSnap = await db
      .collection("schools")
      .doc(schoolId)
      .collection("users")
      .doc(uid)
      .get();

    let userRole =
      (subcomisionUserSnap.data() as { role?: string })?.role ??
      (schoolsUserSnap.data() as { role?: string })?.role ??
      "";

    if (!userRole && emailNorm) {
      try {
        const [usersSub, usersSchool] = await Promise.all([
          db.collection("subcomisiones").doc(schoolId).collection("users").get(),
          db.collection("schools").doc(schoolId).collection("users").get(),
        ]);
        const allDocs = [...usersSub.docs, ...usersSchool.docs];
        const match = allDocs.find(
          (d) => (d.data() as { email?: string }).email?.toLowerCase() === emailNorm
        );
        userRole = (match?.data() as { role?: string })?.role ?? "";
      } catch {
        /* fallback: no role found by email */
      }
    }

    const roleNorm = userRole.trim().toLowerCase();
    const isAdminOrCoach = [
      "admin_subcomision",
      "encargado_deportivo",
      "admin",
      "administrador",
      "school_admin",
      "entrenador",
    ].includes(roleNorm);
    const userInSchool =
      (subcomisionUserSnap.exists || schoolsUserSnap.exists || !!userRole) && isAdminOrCoach;
    const platformSnap = await db.doc(`platformUsers/${uid}`).get();
    const platformData = platformSnap.data() as { gerente_club?: boolean; super_admin?: boolean } | undefined;
    const isSuperAdmin =
      platformSnap.exists && (platformData?.gerente_club ?? platformData?.super_admin) === true;

    if (!userInSchool && !isSuperAdmin) {
      return NextResponse.json(
        {
          error: "Solo el administrador o entrenador de la escuela puede cargar jugadores masivamente",
          detail: `Rol: "${userRole || "—"}". Si sos admin, verificá que tu usuario esté en Gestionar Subcomisión → Responsables para esta subcomisión.`,
        },
        { status: 403 }
      );
    }

    if (!subcomisionUserSnap.exists && !schoolsUserSnap.exists && userRole) {
      await db.collection("subcomisiones").doc(schoolId).collection("users").doc(uid).set(
        {
          role: userRole,
          email: emailNorm,
          displayName: auth.displayName ?? auth.email ?? emailNorm,
        },
        { merge: true }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name ?? "").toLowerCase().split(".").pop();

    let rows: Record<string, unknown>[];
    if (ext === "pdf") {
      rows = await parsePdf(buffer);
      if (!rows.length) {
        return NextResponse.json(
          { error: "No se pudo extraer información del PDF. Probá con un Excel o CSV." },
          { status: 400 }
        );
      }
    } else if (["xlsx", "xls", "csv"].includes(ext ?? "")) {
      rows = parseExcelOrCsv(buffer);
    } else {
      return NextResponse.json(
        { error: "Formato no soportado. Usá .xlsx, .xls, .csv o .pdf" },
        { status: 400 }
      );
    }

    const toCreate: Array<{
      firstName: string;
      lastName: string;
      email: string;
      dni: string;
      tutorContact: { name: string; phone: string };
      birthDate: Date | null;
      healthInsurance: string;
      status: "active" | "inactive";
    }> = [];

    for (const row of rows) {
      const nombre = findColumnValue(row, "nombre") || findColumnValue(row, "apellido");
      const apellido = findColumnValue(row, "apellido") || findColumnValue(row, "nombre");
      if (!nombre && !apellido) continue;

      const tutorNombre = findColumnValue(row, "tutorNombre");
      const tutorTelefono = findColumnValue(row, "tutorTelefono") || findColumnValue(row, "telefono");

      toCreate.push({
        firstName: nombre || "—",
        lastName: apellido || "—",
        email: findColumnValue(row, "email"),
        dni: findColumnValue(row, "dni"),
        tutorContact: {
          name: tutorNombre || "—",
          phone: tutorTelefono || "—",
        },
        birthDate:
        parseDate(findColumnValue(row, "fechaNacimiento")) ??
        birthDateFromAge(parseFloat(findColumnValue(row, "edad") || "0")),
        healthInsurance: findColumnValue(row, "obraSocial"),
        status: "active",
      });
    }

    if (!toCreate.length) {
      return NextResponse.json(
        { error: "No se encontraron filas válidas. Cada fila debe tener al menos nombre o apellido." },
        { status: 400 }
      );
    }

    const sociosRef = db.collection("subcomisiones").doc(schoolId).collection("socios");
    const BATCH_SIZE = 250;
    let created = 0;

    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = toCreate.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        const newRef = sociosRef.doc();
        batch.set(newRef, {
          firstName: item.firstName,
          lastName: item.lastName,
          ...(item.email && { email: item.email.trim().toLowerCase() }),
          dni: item.dni || "",
          tutorContact: item.tutorContact,
          ...(item.birthDate && { birthDate: Timestamp.fromDate(item.birthDate) }),
          ...(item.healthInsurance && { healthInsurance: item.healthInsurance }),
          ...(categoriaId && { categoriaId }),
          status: item.status,
          createdAt: Timestamp.now(),
          createdBy: uid,
          archived: false,
        });
        created++;
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      created,
      total: toCreate.length,
      message: `Se importaron ${created} jugadores correctamente.`,
    });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: number; details?: string };
    const message = err?.message ?? (e instanceof Error ? e.message : String(e));
    const details = err?.details ?? message;
    console.error("[players/bulk-import POST]", e);
    const hint = message.includes("index") || String(err?.code) === "9"
      ? " Puede que falte un índice en Firestore. Revisá la consola del servidor o Firebase Console para crear el índice indicado."
      : "";
    return NextResponse.json(
      { error: "Error al importar jugadores", detail: details + hint },
      { status: 500 }
    );
  }
}
