/**
 * POST /api/qr/validar
 * Valida un QR escaneado por un comercio.
 * Body: { token, comercioId? }
 * Registra el uso en colección usos_qr.
 */

import type admin from 'firebase-admin';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { validarQRToken } from '@/lib/qr';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token as string | undefined;
    const comercioId = body.comercioId as string | undefined;

    if (!token) {
      return NextResponse.json({ error: 'token requerido' }, { status: 400 });
    }

    const payload = await validarQRToken(token);
    if (!payload) {
      return NextResponse.json({ valido: false, error: 'Token inválido o expirado' }, { status: 200 });
    }

    const db = getAdminFirestore();
    const { socioId } = payload;

    // Buscar el socio en subcomisiones
    const subcomisionesSnap = await db.collection('subcomisiones').get();
    let socioDoc: admin.firestore.DocumentSnapshot | null = null;
    let subcomisionId: string | null = null;

    for (const subDoc of subcomisionesSnap.docs) {
      const snap = await db
        .collection('subcomisiones')
        .doc(subDoc.id)
        .collection('socios')
        .doc(socioId)
        .get();
      if (snap.exists) {
        socioDoc = snap;
        subcomisionId = subDoc.id;
        break;
      }
    }

    if (!socioDoc || !subcomisionId) {
      return NextResponse.json({ valido: false, error: 'Socio no encontrado' }, { status: 200 });
    }

    const data = socioDoc.data()!;
    const estaActivo = data.estaActivo ?? data.status === 'active';
    if (!estaActivo) {
      return NextResponse.json({ valido: false, error: 'Socio no activo' }, { status: 200 });
    }

    // Registrar uso en usos_qr
    await db.collection('usos_qr').add({
      socioId,
      comercioId: comercioId ?? null,
      timestamp: new Date(),
      beneficioAplicado: null,
    });

    const nombre = data.nombre ?? data.firstName ?? '';
    const apellido = data.apellido ?? data.lastName ?? '';
    const numeroSocio = (data.numeroSocio ?? socioId).toString();
    const tipoSocio = data.tipoSocio ?? 'general';
    const esFederado = data.esFederado ?? false;

    return NextResponse.json({
      valido: true,
      socio: {
        nombre,
        apellido,
        numeroSocio,
        tipoSocio,
        esFederado,
      },
    });
  } catch (e) {
    console.error('[qr/validar]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al validar QR' },
      { status: 500 }
    );
  }
}
