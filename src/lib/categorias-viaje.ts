/**
 * CRUD de categorías de viaje por subcomisión (U21, U17, etc. con tiras A, B, C).
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { CategoriaViaje } from './types/viaje';

/**
 * Dada la edad que cumple el jugador este año, devuelve el id de la categoría que corresponde.
 * Reglas: U21 = 18–21, U17 = 16–17, U15 = 14–15, U13 = 12–13, U11 = 10–11, U9 = 9 o menos, etc.
 * Parsea U{N} del nombre de categoría; U21 tiene rango de 4 años, U9 cubre 0–9, el resto 2 años.
 */
export function getCategoriaIdFromAge(
  age: number,
  categorias: { id: string; nombre: string }[]
): string | null {
  for (const c of categorias) {
    const match = c.nombre.match(/U(\d+)/i);
    if (!match) continue;
    const n = parseInt(match[1], 10);
    const minAge = n >= 18 ? n - 3 : n <= 9 ? 0 : n - 1;
    const maxAge = n;
    if (age >= minAge && age <= maxAge) return c.id;
  }
  return null;
}

/** Categorías por defecto para básquet */
export const CATEGORIAS_DEFAULT: Omit<CategoriaViaje, 'id' | 'orden'>[] = [
  { nombre: 'U21', tiras: ['A', 'B', 'C'] },
  { nombre: 'U17', tiras: ['A', 'B', 'C'] },
  { nombre: 'U15', tiras: ['A', 'B', 'C'] },
  { nombre: 'U13', tiras: ['A', 'B', 'C'] },
  { nombre: 'U11', tiras: ['A', 'B', 'C'] },
  { nombre: 'U9', tiras: ['A', 'B', 'C'] },
];

function docToCategoria(d: { id: string; data: () => Record<string, unknown> }): CategoriaViaje {
  const data = d.data();
  return {
    id: d.id,
    nombre: (data.nombre as string) ?? '',
    tiras: (data.tiras as string[]) ?? [],
    orden: (data.orden as number) ?? 0,
  };
}

/** Lista categorías de una subcomisión */
export async function listCategorias(
  firestore: Firestore,
  subcomisionId: string
): Promise<CategoriaViaje[]> {
  const col = collection(firestore, 'subcomisiones', subcomisionId, 'categorias');
  const q = query(col, orderBy('orden', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToCategoria(d));
}

/** Crea una categoría */
export async function createCategoria(
  firestore: Firestore,
  subcomisionId: string,
  input: { nombre: string; tiras?: string[] }
): Promise<string> {
  const col = collection(firestore, 'subcomisiones', subcomisionId, 'categorias');
  const snap = await getDocs(col);
  const orden = snap.size;
  const ref = doc(col);
  await setDoc(ref, {
    nombre: input.nombre.trim(),
    tiras: input.tiras ?? [],
    orden,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Actualiza una categoría */
export async function updateCategoria(
  firestore: Firestore,
  subcomisionId: string,
  categoriaId: string,
  input: { nombre?: string; tiras?: string[]; orden?: number }
): Promise<void> {
  const ref = doc(firestore, 'subcomisiones', subcomisionId, 'categorias', categoriaId);
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.nombre !== undefined) updates.nombre = input.nombre.trim();
  if (input.tiras !== undefined) updates.tiras = input.tiras;
  if (input.orden !== undefined) updates.orden = input.orden;
  await updateDoc(ref, updates as Parameters<typeof updateDoc>[1]);
}

/** Elimina una categoría */
export async function deleteCategoria(
  firestore: Firestore,
  subcomisionId: string,
  categoriaId: string
): Promise<void> {
  const ref = doc(firestore, 'subcomisiones', subcomisionId, 'categorias', categoriaId);
  await deleteDoc(ref);
}

/** Crea categorías por defecto (U21, U17, etc.) */
export async function seedCategoriasDefault(
  firestore: Firestore,
  subcomisionId: string
): Promise<void> {
  const existing = await listCategorias(firestore, subcomisionId);
  if (existing.length > 0) return;
  for (let i = 0; i < CATEGORIAS_DEFAULT.length; i++) {
    const c = CATEGORIAS_DEFAULT[i];
    await createCategoria(firestore, subcomisionId, {
      nombre: c.nombre,
      tiras: c.tiras,
    });
  }
}
