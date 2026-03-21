/**
 * CRUD de comercios (convenios con locales para beneficios de socios).
 * Usa firebase-admin (solo servidor).
 */

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { Comercio } from '@/lib/types/comercio';

const COMERCIOS_COLLECTION = 'comercios';

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  const t = val as { toDate?: () => Date };
  if (typeof t?.toDate === 'function') return t.toDate();
  if (typeof val === 'string') return new Date(val);
  return new Date();
}

function docToComercio(id: string, data: Record<string, unknown>): Comercio {
  return {
    id,
    razonSocial: String(data.razonSocial ?? ''),
    cuit: String(data.cuit ?? ''),
    rubro: String(data.rubro ?? ''),
    domicilio: String(data.domicilio ?? ''),
    localidad: String(data.localidad ?? ''),
    telefono: String(data.telefono ?? ''),
    email: String(data.email ?? ''),
    responsable: String(data.responsable ?? ''),
    dniResponsable: String(data.dniResponsable ?? ''),
    instagram: data.instagram as string | undefined,
    web: data.web as string | undefined,
    logo: data.logo as string | undefined,
    tipoBeneficio: String(data.tipoBeneficio ?? ''),
    porcentajeDescuento: data.porcentajeDescuento as number | undefined,
    productosIncluidos: String(data.productosIncluidos ?? ''),
    productosExcluidos: data.productosExcluidos as string | undefined,
    diasHorarios: data.diasHorarios as string | undefined,
    condicionesEspeciales: data.condicionesEspeciales as string | undefined,
    topeUsosMensuales: (data.topeUsosMensuales as number | null) ?? null,
    estadoConvenio: (data.estadoConvenio as Comercio['estadoConvenio']) ?? 'pendiente',
    fechaInicio: String(data.fechaInicio ?? ''),
    fechaVencimiento: String(data.fechaVencimiento ?? ''),
    renovacionAutomatica: Boolean(data.renovacionAutomatica),
    creadoEn: String(data.creadoEn ?? ''),
    actualizadoEn: String(data.actualizadoEn ?? ''),
  };
}

export async function getComercio(id: string): Promise<Comercio | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COMERCIOS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return docToComercio(snap.id, snap.data()!);
}

export async function getComerciosActivos(): Promise<Comercio[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COMERCIOS_COLLECTION)
    .where('estadoConvenio', '==', 'activo')
    .get();
  return snap.docs.map((d) => docToComercio(d.id, d.data()));
}

export async function getAllComercios(): Promise<Comercio[]> {
  const db = getAdminFirestore();
  const snap = await db.collection(COMERCIOS_COLLECTION).orderBy('razonSocial').get();
  return snap.docs.map((d) => docToComercio(d.id, d.data()));
}

export async function createComercio(
  data: Omit<Comercio, 'id' | 'creadoEn' | 'actualizadoEn'>
): Promise<Comercio> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const doc = {
    ...data,
    creadoEn: now,
    actualizadoEn: now,
  };
  const ref = await db.collection(COMERCIOS_COLLECTION).add(doc);
  return getComercio(ref.id) as Promise<Comercio>;
}

export async function updateComercio(
  id: string,
  data: Partial<Omit<Comercio, 'id' | 'creadoEn'>> &
    { actualizadoEn?: string }
): Promise<void> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  await db.collection(COMERCIOS_COLLECTION).doc(id).update({
    ...data,
    actualizadoEn: data.actualizadoEn ?? now,
  });
}

export async function deleteComercio(id: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(COMERCIOS_COLLECTION).doc(id).delete();
}
