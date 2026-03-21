/**
 * GET /api/admin/comercios — Lista todos los comercios (solo super admin)
 * POST /api/admin/comercios — Crea comercio (solo super admin)
 */

import { NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';
import { getAllComercios, createComercio } from '@/lib/comercios';
import type { Comercio } from '@/lib/types/comercio';

export async function GET(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const comercios = await getAllComercios();
    return NextResponse.json(comercios);
  } catch (e) {
    console.error('[api/admin/comercios GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar comercios' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifySuperAdmin(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<Comercio>;
    const comercio = await createComercio({
      razonSocial: body.razonSocial ?? '',
      cuit: body.cuit ?? '',
      rubro: body.rubro ?? '',
      domicilio: body.domicilio ?? '',
      localidad: body.localidad ?? '',
      telefono: body.telefono ?? '',
      email: body.email ?? '',
      responsable: body.responsable ?? '',
      dniResponsable: body.dniResponsable ?? '',
      instagram: body.instagram,
      web: body.web,
      logo: body.logo,
      tipoBeneficio: body.tipoBeneficio ?? '',
      porcentajeDescuento: body.porcentajeDescuento,
      productosIncluidos: body.productosIncluidos ?? '',
      productosExcluidos: body.productosExcluidos,
      diasHorarios: body.diasHorarios,
      condicionesEspeciales: body.condicionesEspeciales,
      topeUsosMensuales: body.topeUsosMensuales ?? null,
      estadoConvenio: (body.estadoConvenio as Comercio['estadoConvenio']) ?? 'pendiente',
      fechaInicio: body.fechaInicio ?? new Date().toISOString(),
      fechaVencimiento: body.fechaVencimiento ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      renovacionAutomatica: Boolean(body.renovacionAutomatica),
    });

    return NextResponse.json(comercio);
  } catch (e) {
    console.error('[api/admin/comercios POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al crear comercio' },
      { status: 500 }
    );
  }
}
