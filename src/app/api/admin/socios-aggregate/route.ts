/**
 * GET /api/admin/socios-aggregate
 * Une collectionGroup(socios) + collectionGroup(players) para el panel del gerente.
 */

import { NextResponse } from 'next/server';
import type { QuerySnapshot } from 'firebase-admin/firestore';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getAdminFirestore } from '@/lib/firebase-admin';

const LIMIT = 10_000;

function tsToIso(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const db = getAdminFirestore();
    const [sociosSnap, playersSnap] = await Promise.all([
      db.collectionGroup('socios').limit(LIMIT).get(),
      db.collectionGroup('players').limit(LIMIT).get(),
    ]);

    type Row = Record<string, unknown> & {
      id: string;
      subcomisionId: string;
      nombre: string;
      apellido: string;
      firstName: string;
      lastName: string;
      email: string;
      createdAt: string;
    };

    const list: Row[] = [];

    const addFrom = (snap: QuerySnapshot) => {
      for (const d of snap.docs) {
        const pathParts = d.ref.path.split('/');
        const subcomisionId = pathParts[1];
        const data = d.data();
        const nombre = String(data.nombre ?? data.firstName ?? '');
        const apellido = String(data.apellido ?? data.lastName ?? '');
        const createdRaw = data.createdAt ?? data.fechaAlta;
        const createdAt = tsToIso(createdRaw) ?? new Date(0).toISOString();
        list.push({
          ...data,
          id: d.id,
          subcomisionId,
          nombre,
          apellido,
          firstName: nombre,
          lastName: apellido,
          email: String(data.email ?? ''),
          dni: data.dni ?? '',
          telefono: data.telefono ?? '',
          fechaNacimiento: data.fechaNacimiento ?? '',
          fechaAlta: data.fechaAlta ?? '',
          numeroSocio: data.numeroSocio ?? '',
          tipoSocio: data.tipoSocio ?? 'general',
          esFederado: data.esFederado ?? false,
          esVitalicio: data.esVitalicio ?? false,
          estaActivo: data.estaActivo ?? true,
          subcomisiones: data.subcomisiones ?? [subcomisionId],
          status: data.status ?? 'active',
          archived: data.archived ?? false,
          createdAt,
          birthDate: tsToIso(data.birthDate),
          tutorContact: data.tutorContact ?? { name: '', phone: '' },
          createdBy: data.createdBy ?? '',
        });
      }
    };

    addFrom(sociosSnap);
    addFrom(playersSnap);

    const seen = new Set<string>();
    const merged = list.filter((s) => {
      const key = `${s.subcomisionId}:${s.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ items: merged });
  } catch (e) {
    console.error('[admin/socios-aggregate]', e);
    return NextResponse.json({ error: 'Error al cargar socios' }, { status: 500 });
  }
}
