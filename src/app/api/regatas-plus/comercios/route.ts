/**
 * GET /api/regatas-plus/comercios
 * Lista comercios activos (público, para Regatas+).
 */

import { NextResponse } from 'next/server';
import { getComerciosActivos } from '@/lib/comercios';

export async function GET() {
  try {
    const comercios = await getComerciosActivos();
    return NextResponse.json(comercios);
  } catch (e) {
    console.error('[api/regatas-plus/comercios]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar comercios' },
      { status: 500 }
    );
  }
}
