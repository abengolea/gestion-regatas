/**
 * GET /api/payments/verify-subcomision?subcomisionId=xxx
 * Devuelve qué ve el backend para esa subcomisión (socios).
 * Sirve para comparar con lo que muestra la app y detectar inconsistencias.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subcomisionId = searchParams.get('subcomisionId') ?? searchParams.get('schoolId');
    if (!subcomisionId) {
      return NextResponse.json(
        { error: 'Falta subcomisionId (query: ?subcomisionId=xxx)' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const sociosRef = db.collection('subcomisiones').doc(subcomisionId).collection('socios');
    const snap = await sociosRef.get();

    const socioIds = snap.docs.map((d) => d.id);
    const socioNames = snap.docs.map((d) => {
      const d_ = d.data() as { nombre?: string; apellido?: string; firstName?: string; lastName?: string };
      const nom = d_.nombre ?? d_.firstName ?? '';
      const ape = d_.apellido ?? d_.lastName ?? '';
      return [d.id, `${ape} ${nom}`.trim() || d.id];
    });

    return NextResponse.json({
      subcomisionId,
      socioCount: snap.size,
      socioIds,
      socios: Object.fromEntries(socioNames),
    });
  } catch (e) {
    console.error('verify-subcomision', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al verificar subcomisión' },
      { status: 500 }
    );
  }
}
