/**
 * CRUD de viajes y subcolecciones (pagos, documentación).
 * Regatas+ — Club de Regatas San Nicolás
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Viaje, PagoViaje, DocViaje, DocRequerida } from './types/viaje';
import { toDateSafe } from './utils';

function toDate(val: unknown): Date {
  return toDateSafe(val);
}

/** Convierte doc Firestore a Viaje */
export function docToViaje(docSnap: { id: string; data: () => Record<string, unknown> }): Viaje {
  const d = docSnap.data();
  const metodoPagoHabilitado = (d.metodoPagoHabilitado as Viaje['metodoPagoHabilitado']) ?? ['transferencia_whatsapp', 'transferencia_app'];
  const metodoPagoLegacy = d.metodoPago as Viaje['metodoPago'] | undefined;
  return {
    id: docSnap.id,
    subcomisionId: (d.subcomisionId as string) ?? '',
    destino: (d.destino as string) ?? '',
    descripcion: d.descripcion as string | undefined,
    fechaSalida: (d.fechaSalida as Timestamp) ?? new Date(),
    fechaRegreso: (d.fechaRegreso as Timestamp) ?? new Date(),
    precioPorJugador: Math.round((d.precioPorJugador as number) ?? 0),
    metodoPagoHabilitado,
    metodoPago: metodoPagoLegacy,
    cbuClub: d.cbuClub as string | undefined,
    aliasClub: d.aliasClub as string | undefined,
    vencimientoPago: (d.vencimientoPago as Timestamp) ?? new Date(),
    documentacionRequerida: (d.documentacionRequerida as DocRequerida[]) ?? [],
    estado: (d.estado as Viaje['estado']) ?? 'borrador',
    jugadoresDesignados: (d.jugadoresDesignados as string[]) ?? [],
    categoriaIds: (d.categoriaIds as string[]) ?? [],
    jugadoresPorCategoria: (d.jugadoresPorCategoria as Record<string, string[]>) ?? undefined,
    creadoPor: (d.creadoPor as string) ?? '',
    creadoEn: (d.creadoEn as Timestamp) ?? new Date(),
    updatedAt: (d.updatedAt as Timestamp) ?? new Date(),
  };
}

/** Convierte doc Firestore a PagoViaje */
export function docToPagoViaje(
  docSnap: { id: string; data: () => Record<string, unknown> },
  viajeId: string
): PagoViaje {
  const d = docSnap.data();
  const metodoPago = (d.metodoPago as PagoViaje['metodoPago']) ?? 'transferencia_app';
  return {
    id: docSnap.id,
    viajeId,
    socioId: (d.socioId as string) ?? docSnap.id,
    monto: Math.round((d.monto as number) ?? 0),
    metodoPago,
    estado: (d.estado as PagoViaje['estado']) ?? 'pendiente',
    comprobanteUrl: (d.comprobanteUrl ?? d.comprobante) as string | undefined,
    comprobanteFuente: d.comprobanteFuente as 'whatsapp' | 'app' | undefined,
    providerPaymentId: d.providerPaymentId as string | undefined,
    mpPreferenceId: d.mpPreferenceId as string | undefined,
    mpPaymentId: d.mpPaymentId as string | undefined,
    comprobante: d.comprobante as string | undefined,
    notificadoEn: d.notificadoEn as Timestamp | undefined,
    confirmadoEn: d.confirmadoEn as Timestamp | undefined,
  };
}

/** Convierte doc Firestore a DocViaje */
export function docToDocViaje(
  docSnap: { id: string; data: () => Record<string, unknown> },
  viajeId: string
): DocViaje {
  const d = docSnap.data();
  return {
    socioId: (d.socioId as string) ?? docSnap.id,
    viajeId,
    dni: (d.dni as boolean) ?? false,
    aps: (d.aps as boolean) ?? false,
    apf: (d.apf as boolean) ?? false,
    autorizacion: (d.autorizacion as boolean) ?? false,
    updatedAt: (d.updatedAt as Timestamp) ?? new Date(),
  };
}

export interface CreateViajeInput {
  subcomisionId: string;
  destino: string;
  descripcion?: string;
  fechaSalida: Date;
  fechaRegreso: Date;
  precioPorJugador: number;
  metodoPago?: Viaje['metodoPago'];
  metodoPagoHabilitado?: Viaje['metodoPagoHabilitado'];
  cbuClub?: string;
  aliasClub?: string;
  vencimientoPago: Date;
  documentacionRequerida: DocRequerida[];
  categoriaIds?: string[];
  creadoPor: string;
}

/** Crea un viaje en estado borrador */
export async function createViaje(
  firestore: Firestore,
  input: CreateViajeInput
): Promise<string> {
  const ref = doc(collection(firestore, 'viajes'));
  const now = serverTimestamp();
  const metodoPagoHabilitado = input.metodoPagoHabilitado ?? (input.metodoPago === 'mp' ? (['mercadopago'] as const) : (['transferencia_whatsapp', 'transferencia_app'] as const));
  const data = {
    subcomisionId: input.subcomisionId,
    destino: input.destino,
    descripcion: input.descripcion ?? null,
    fechaSalida: input.fechaSalida,
    fechaRegreso: input.fechaRegreso,
    precioPorJugador: Math.round(input.precioPorJugador),
    metodoPago: input.metodoPago ?? 'ambos',
    metodoPagoHabilitado,
    cbuClub: input.cbuClub ?? process.env.CLUB_CBU ?? null,
    aliasClub: input.aliasClub ?? process.env.CLUB_ALIAS ?? null,
    vencimientoPago: input.vencimientoPago,
    documentacionRequerida: input.documentacionRequerida,
    estado: 'borrador',
    jugadoresDesignados: [],
    categoriaIds: input.categoriaIds ?? [],
    jugadoresPorCategoria: {},
    creadoPor: input.creadoPor,
    creadoEn: now,
    updatedAt: now,
  };
  await setDoc(ref, data);
  return ref.id;
}

export interface UpdateViajeInput {
  destino?: string;
  descripcion?: string;
  fechaSalida?: Date;
  fechaRegreso?: Date;
  precioPorJugador?: number;
  metodoPago?: Viaje['metodoPago'];
  metodoPagoHabilitado?: Viaje['metodoPagoHabilitado'];
  cbuClub?: string;
  aliasClub?: string;
  vencimientoPago?: Date;
  documentacionRequerida?: DocRequerida[];
  categoriaIds?: string[];
  jugadoresPorCategoria?: Record<string, string[]>;
  estado?: Viaje['estado'];
}

/** Actualiza un viaje existente */
export async function updateViaje(
  firestore: Firestore,
  viajeId: string,
  input: UpdateViajeInput
): Promise<void> {
  const ref = doc(firestore, 'viajes', viajeId);
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (input.destino !== undefined) updates.destino = input.destino;
  if (input.descripcion !== undefined) updates.descripcion = input.descripcion;
  if (input.fechaSalida !== undefined) updates.fechaSalida = input.fechaSalida;
  if (input.fechaRegreso !== undefined) updates.fechaRegreso = input.fechaRegreso;
  if (input.precioPorJugador !== undefined) updates.precioPorJugador = Math.round(input.precioPorJugador);
  if (input.metodoPago !== undefined) updates.metodoPago = input.metodoPago;
  if (input.metodoPagoHabilitado !== undefined) updates.metodoPagoHabilitado = input.metodoPagoHabilitado;
  if (input.cbuClub !== undefined) updates.cbuClub = input.cbuClub;
  if (input.aliasClub !== undefined) updates.aliasClub = input.aliasClub;
  if (input.vencimientoPago !== undefined) updates.vencimientoPago = input.vencimientoPago;
  if (input.documentacionRequerida !== undefined) updates.documentacionRequerida = input.documentacionRequerida;
  if (input.categoriaIds !== undefined) updates.categoriaIds = input.categoriaIds;
  if (input.jugadoresPorCategoria !== undefined) updates.jugadoresPorCategoria = input.jugadoresPorCategoria;
  if (input.estado !== undefined) updates.estado = input.estado;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(ref, updates as any);
}

/** Obtiene un viaje por ID */
export async function getViaje(
  firestore: Firestore,
  viajeId: string
): Promise<Viaje | null> {
  const ref = doc(firestore, 'viajes', viajeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToViaje({ id: snap.id, data: () => snap.data() ?? {} });
}

/** Lista viajes de una subcomisión */
export async function listViajes(
  firestore: Firestore,
  subcomisionId: string
): Promise<Viaje[]> {
  const col = collection(firestore, 'viajes');
  const q = query(
    col,
    where('subcomisionId', '==', subcomisionId),
    orderBy('fechaSalida', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToViaje(d));
}

/** Designa jugadores a un viaje: crea pago y documentación vacíos */
export async function designarJugador(
  firestore: Firestore,
  viajeId: string,
  socioId: string,
  precioPorJugador: number,
  metodoPago: 'mp' | 'transferencia'
): Promise<void> {
  const pagoRef = doc(firestore, 'viajes', viajeId, 'pagos', socioId);
  const docRef = doc(firestore, 'viajes', viajeId, 'documentacion', socioId);
  const now = serverTimestamp();

  await setDoc(pagoRef, {
    viajeId,
    socioId,
    monto: Math.round(precioPorJugador),
    metodoPago,
    estado: 'pendiente',
    updatedAt: now,
  });

  await setDoc(docRef, {
    socioId,
    viajeId,
    dni: false,
    aps: false,
    apf: false,
    autorizacion: false,
    updatedAt: now,
  });
}

/** Quita un jugador designado */
export async function quitarJugadorDesignado(
  firestore: Firestore,
  viajeId: string,
  socioId: string
): Promise<void> {
  const pagoRef = doc(firestore, 'viajes', viajeId, 'pagos', socioId);
  const docRef = doc(firestore, 'viajes', viajeId, 'documentacion', socioId);
  await deleteDoc(pagoRef);
  await deleteDoc(docRef);
}

/** Actualiza jugadoresDesignados y opcionalmente jugadoresPorCategoria */
export async function syncJugadoresDesignados(
  firestore: Firestore,
  viajeId: string,
  socioIds: string[],
  jugadoresPorCategoria?: Record<string, string[]>
): Promise<void> {
  const ref = doc(firestore, 'viajes', viajeId);
  const updates: Record<string, unknown> = {
    jugadoresDesignados: socioIds,
    updatedAt: serverTimestamp(),
  };
  if (jugadoresPorCategoria !== undefined) updates.jugadoresPorCategoria = jugadoresPorCategoria;
  await updateDoc(ref, updates as Parameters<typeof updateDoc>[1]);
}

/** Agrega socio al viaje (designar + sync). Si categoriaId se indica, actualiza jugadoresPorCategoria. */
export async function agregarJugadorAlViaje(
  firestore: Firestore,
  viaje: Viaje,
  socioId: string,
  categoriaId?: string
): Promise<void> {
  const precio = Math.round(viaje.precioPorJugador);
  const metodoDefault: 'mp' | 'transferencia' =
    viaje.metodoPago === 'ambos' ? 'mp' : (viaje.metodoPago ?? 'mp');

  await designarJugador(firestore, viaje.id, socioId, precio, metodoDefault);

  const current = viaje.jugadoresDesignados ?? [];
  if (!current.includes(socioId)) {
    const newDesignados = [...current, socioId];
    let newPorCategoria = viaje.jugadoresPorCategoria ?? {};
    if (categoriaId) {
      const list = newPorCategoria[categoriaId] ?? [];
      if (!list.includes(socioId)) {
        newPorCategoria = { ...newPorCategoria, [categoriaId]: [...list, socioId] };
      }
    }
    await syncJugadoresDesignados(firestore, viaje.id, newDesignados, newPorCategoria);
  }
}

/** Quita socio del viaje. Si categoriaId se indica, lo quita de jugadoresPorCategoria. */
export async function quitarJugadorDelViaje(
  firestore: Firestore,
  viajeId: string,
  socioId: string,
  jugadoresDesignados: string[],
  viaje?: Viaje,
  categoriaId?: string
): Promise<void> {
  await quitarJugadorDesignado(firestore, viajeId, socioId);
  const updated = jugadoresDesignados.filter((id) => id !== socioId);
  let newPorCategoria = viaje?.jugadoresPorCategoria ?? {};
  if (categoriaId) {
    const list = newPorCategoria[categoriaId] ?? [];
    newPorCategoria = { ...newPorCategoria, [categoriaId]: list.filter((id) => id !== socioId) };
  }
  await syncJugadoresDesignados(firestore, viajeId, updated, newPorCategoria);
}

/** Lista pagos de un viaje */
export async function listPagosViaje(
  firestore: Firestore,
  viajeId: string
): Promise<PagoViaje[]> {
  const col = collection(firestore, 'viajes', viajeId, 'pagos');
  const snap = await getDocs(col);
  return snap.docs.map((d) => docToPagoViaje(d, viajeId));
}

/** Lista documentación de un viaje */
export async function listDocViaje(
  firestore: Firestore,
  viajeId: string
): Promise<DocViaje[]> {
  const col = collection(firestore, 'viajes', viajeId, 'documentacion');
  const snap = await getDocs(col);
  return snap.docs.map((d) => docToDocViaje(d, viajeId));
}

/** Actualiza documentación de un socio en un viaje */
export async function updateDocViaje(
  firestore: Firestore,
  viajeId: string,
  socioId: string,
  data: Partial<Pick<DocViaje, 'dni' | 'aps' | 'apf' | 'autorizacion'>>
): Promise<void> {
  const ref = doc(firestore, 'viajes', viajeId, 'documentacion', socioId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Marca pago como pagado manualmente (transferencia + comprobante) */
export async function marcarPagoManual(
  firestore: Firestore,
  viajeId: string,
  socioId: string,
  comprobanteUrl: string
): Promise<void> {
  const ref = doc(firestore, 'viajes', viajeId, 'pagos', socioId);
  await updateDoc(ref, {
    estado: 'pagado',
    metodoPago: 'transferencia',
    comprobante: comprobanteUrl,
    confirmadoEn: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
