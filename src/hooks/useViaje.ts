'use client';

/**
 * Hooks para el módulo de Viajes.
 * Regatas+ — Club de Regatas San Nicolás
 */

import { useMemo, useCallback } from 'react';
import { useFirestore } from '@/firebase/provider';
import { useCollection, useDoc } from '@/firebase';
import type { Viaje, PagoViaje, DocViaje } from '@/lib/types/viaje';
import { toDateSafe } from '@/lib/utils';

const VIAJE_DATE_FIELDS = ['fechaSalida', 'fechaRegreso', 'vencimientoPago', 'creadoEn', 'updatedAt'];
const PAGO_DATE_FIELDS = ['notificadoEn', 'confirmadoEn'];
const DOC_DATE_FIELDS = ['updatedAt'];

function processViaje<T extends Viaje>(v: T): T {
  const out = { ...v } as T;
  for (const key of VIAJE_DATE_FIELDS) {
    const val = (out as Record<string, unknown>)[key];
    if (val) (out as Record<string, unknown>)[key] = toDateSafe(val);
  }
  return out;
}

function processPago<T extends PagoViaje>(p: T): T {
  const out = { ...p };
  for (const key of PAGO_DATE_FIELDS) {
    const val = (out as Record<string, unknown>)[key];
    if (val) (out as Record<string, unknown>)[key] = toDateSafe(val);
  }
  return out;
}

function processDoc<T extends DocViaje>(d: T): T {
  const out = { ...d };
  for (const key of DOC_DATE_FIELDS) {
    const val = (out as Record<string, unknown>)[key];
    if (val) (out as Record<string, unknown>)[key] = toDateSafe(val);
  }
  return out;
}

/** Hook para un solo viaje */
export function useViaje(viajeId: string | null) {
  const firestore = useFirestore();
  const path = viajeId ? `viajes/${viajeId}` : '';
  const { data: rawViaje, loading: viajeLoading, error: viajeError } = useDoc<Viaje>(path);

  const viaje = useMemo(() => (rawViaje ? processViaje(rawViaje) : null), [rawViaje]);

  const pagosPath = viajeId ? `viajes/${viajeId}/pagos` : '';
  const { data: rawPagos, loading: pagosLoading } = useCollection<PagoViaje>(pagosPath, {});

  const pagos = useMemo(() => {
    if (!rawPagos) return [];
    return rawPagos.map((p) => processPago({ ...p, viajeId: viajeId! }));
  }, [rawPagos, viajeId]);

  const docPath = viajeId ? `viajes/${viajeId}/documentacion` : '';
  const { data: rawDocs, loading: docLoading } = useCollection<DocViaje & { id: string }>(docPath, {});

  const documentacion = useMemo(() => {
    if (!rawDocs) return [];
    return rawDocs.map((d) => processDoc({ ...d, viajeId: viajeId! }));
  }, [rawDocs, viajeId]);

  const loading = viajeLoading || pagosLoading || docLoading;

  return {
    viaje,
    pagos,
    documentacion,
    loading,
    error: viajeError,
  };
}

/** Hook para lista de viajes de una subcomisión */
export function useViajes(subcomisionId: string | null) {
  const path = subcomisionId
    ? `viajes` // useCollection no soporta where en path - usamos query
    : '';
  const { data: rawViajes, loading } = useCollection<Viaje>(path, {
    where: subcomisionId ? ['subcomisionId', '==', subcomisionId] : undefined,
    orderBy: ['fechaSalida', 'desc'],
  });

  const viajes = useMemo(() => (rawViajes ?? []).map(processViaje), [rawViajes]);

  return { viajes, loading };
}

/** Hook para un pago específico de un viaje */
export function usePagoViaje(viajeId: string | null, socioId: string | null) {
  const path =
    viajeId && socioId ? `viajes/${viajeId}/pagos/${socioId}` : '';
  const { data: rawPago, loading } = useDoc<PagoViaje & { viajeId?: string }>(path);

  const pago = useMemo(() => {
    if (!rawPago) return null;
    return processPago({ ...rawPago, viajeId: viajeId! });
  }, [rawPago, viajeId]);

  return { pago, loading };
}

/** Estadísticas calculadas de un viaje */
export interface StatsViaje {
  totalDesignados: number;
  totalPagados: number;
  montoRecaudado: number;
  montoPendiente: number;
  porcentajeRecaudado: number;
  docCompleta: number;
  docIncompleta: number;
}

export function useStatsViaje(viaje: Viaje | null, pagos: PagoViaje[], documentacion: DocViaje[]) {
  return useMemo(() => {
    if (!viaje) {
      return {
        totalDesignados: 0,
        totalPagados: 0,
        montoRecaudado: 0,
        montoPendiente: 0,
        porcentajeRecaudado: 0,
        docCompleta: 0,
        docIncompleta: 0,
      } satisfies StatsViaje;
    }

    const totalDesignados = viaje.jugadoresDesignados?.length ?? pagos.length;
    const totalPagados = pagos.filter((p) => p.estado === 'pagado').length;
    const precio = Math.round(viaje.precioPorJugador);
    const montoRecaudado = totalPagados * precio;
    const montoTotal = totalDesignados * precio;
    const montoPendiente = montoTotal - montoRecaudado;
    const porcentajeRecaudado =
      totalDesignados > 0 ? Math.round((totalPagados / totalDesignados) * 100) : 0;

    const req = viaje.documentacionRequerida ?? [];
    const docCompleta = documentacion.filter((d) =>
      req.every((r) => (d as unknown as Record<string, boolean>)[r] === true)
    ).length;
    const docIncompleta = totalDesignados - docCompleta;

    return {
      totalDesignados,
      totalPagados,
      montoRecaudado,
      montoPendiente,
      porcentajeRecaudado,
      docCompleta,
      docIncompleta,
    } satisfies StatsViaje;
  }, [viaje, pagos, documentacion]);
}
