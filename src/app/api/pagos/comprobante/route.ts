/**
 * POST /api/pagos/comprobante
 * Multipart: viajeId, socioId, imagen
 * Upload a Storage, estado → 'en_revision'
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { message: 'Content-Type multipart/form-data requerido' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const viajeId = formData.get('viajeId') as string | null;
    const socioId = formData.get('socioId') as string | null;
    const file = formData.get('imagen') as File | null;

    if (!viajeId || !socioId || !file) {
      return NextResponse.json(
        { message: 'viajeId, socioId e imagen requeridos' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const viajeSnap = await db.collection('viajes').doc(viajeId).get();
    if (!viajeSnap.exists) {
      return NextResponse.json({ message: 'Viaje no encontrado' }, { status: 404 });
    }

    const designados = (viajeSnap.data()?.jugadoresDesignados ?? []) as string[];
    if (!designados.includes(socioId)) {
      return NextResponse.json({ message: 'Socio no designado en este viaje' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() ?? 'jpg';
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const ts = Date.now();
    const path = `comprobantes/${viajeId}/${socioId}/${ts}.${ext}`;
    const storageFile = bucket.file(path);
    await storageFile.save(buffer, {
      contentType: file.type || 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await storageFile.makePublic();
    const comprobanteUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

    const admin = await import('firebase-admin');
    const pagoRef = db.collection('viajes').doc(viajeId).collection('pagos').doc(socioId);
    await pagoRef.set(
      {
        viajeId,
        socioId,
        monto: Math.round(viajeSnap.data()?.precioPorJugador ?? 0),
        metodoPago: 'transferencia_app',
        estado: 'en_revision',
        comprobanteFuente: 'app',
        comprobanteUrl,
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      comprobanteUrl,
      message: 'Recibimos tu comprobante. El admin lo revisará y te avisamos por WhatsApp.',
    });
  } catch (e) {
    console.error('[pagos/comprobante]', e);
    return NextResponse.json(
      { message: (e as Error).message },
      { status: 500 }
    );
  }
}
