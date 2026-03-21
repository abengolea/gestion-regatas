/**
 * POST /api/qr/generar
 * Genera un QR token para el socio autenticado.
 * Body: { socioId }
 * Solo puede llamarlo el propio socio (verificar uid de Firebase Auth).
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';
import { generarQRToken } from '@/lib/qr';

const EXPIRACION_MINUTOS = 10;

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const socioId = body.socioId as string | undefined;
    if (!socioId) {
      return NextResponse.json({ error: 'socioId requerido' }, { status: 400 });
    }

    const db = getAdminFirestore();
    // Buscar el socio en cualquier subcomisión (collectionGroup o iterar)
    const subcomisionesSnap = await db.collection('subcomisiones').get();
    let socioDoc: { id: string; data: Record<string, unknown> } | null = null;

    for (const subDoc of subcomisionesSnap.docs) {
      const socioSnap = await db
        .collection('subcomisiones')
        .doc(subDoc.id)
        .collection('socios')
        .doc(socioId)
        .get();
      const data = socioSnap.exists ? socioSnap.data() : undefined;
      if (data) {
        socioDoc = { id: socioSnap.id, data: data as Record<string, unknown> };
        break;
      }
    }

    if (!socioDoc) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
    }

    const data = socioDoc.data;
    const email = (data.email ?? '').toString().toLowerCase();
    const authEmail = (auth.email ?? '').toString().toLowerCase();
    if (email && authEmail && email !== authEmail) {
      return NextResponse.json(
        { error: 'Solo el propio socio puede generar el QR' },
        { status: 403 }
      );
    }

    const estaActivo = data.estaActivo ?? data.status === 'active';
    if (!estaActivo) {
      return NextResponse.json(
        { error: 'Socio no activo' },
        { status: 400 }
      );
    }

    const numeroSocio = (data.numeroSocio ?? data.id ?? socioId).toString();
    const token = await generarQRToken(socioId, numeroSocio);
    const expiraEn = new Date(Date.now() + EXPIRACION_MINUTOS * 60 * 1000);

    return NextResponse.json({
      token,
      expiraEn: expiraEn.toISOString(),
    });
  } catch (e) {
    console.error('[qr/generar]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar QR' },
      { status: 500 }
    );
  }
}
