/**
 * GET /api/admin/comercios/[id] — Obtiene un comercio
 * PUT /api/admin/comercios/[id] — Actualiza comercio
 * DELETE /api/admin/comercios/[id] — Borra comercio
 * Solo super admin.
 */

import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getComercio, updateComercio, deleteComercio } from '@/lib/comercios';
import type { Comercio } from '@/lib/types/comercio';

async function requireSuperAdmin(request: Request) {
  const auth = await verifySuperAdmin(request.headers.get('Authorization'));
  if (!auth) return null;
  return auth;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const comercio = await getComercio(id);
    if (!comercio) {
      return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 });
    }
    return NextResponse.json(comercio);
  } catch (e) {
    console.error('[api/admin/comercios/[id] GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = (await request.json()) as Partial<Comercio>;
    await updateComercio(id, body);
    const comercio = await getComercio(id);
    return NextResponse.json(comercio ?? { id });
  } catch (e) {
    console.error('[api/admin/comercios/[id] PUT]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al actualizar' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    await deleteComercio(id);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error('[api/admin/comercios/[id] DELETE]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al borrar' },
      { status: 500 }
    );
  }
}
