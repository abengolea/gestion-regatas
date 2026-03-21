'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useViaje, useStatsViaje } from '@/hooks/useViaje';
import { JugadoresDesignados } from '@/components/viajes/JugadoresDesignados';
import { PagoRow } from '@/components/viajes/PagoRow';
import { ViajeStats } from '@/components/viajes/ViajeStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Pencil, FileSpreadsheet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase';
import type { Socio } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  finalizado: 'Finalizado',
};

export default function ViajeDetallePage() {
  const params = useParams();
  const router = useRouter();
  const subcomisionId = params.subcomisionId as string;
  const viajeId = params.viajeId as string;
  const { toast } = useToast();
  const [generandoLinks, setGenerandoLinks] = useState(false);

  const { viaje, pagos, documentacion, loading } = useViaje(viajeId);
  const stats = useStatsViaje(viaje, pagos, documentacion);

  const sociosPath = subcomisionId ? `subcomisiones/${subcomisionId}/socios` : '';
  const { data: socios } = useCollection<Socio>(sociosPath, { orderBy: ['apellido', 'asc'] });
  const { data: categorias } = useCollection<{ id: string; nombre: string }>(
    subcomisionId ? `subcomisiones/${subcomisionId}/categorias` : '',
    { orderBy: ['orden', 'asc'] }
  );

  const sociosMap = useMemo(() => {
    const m = new Map<string, Socio>();
    (socios ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [socios]);

  const handleGenerarLinks = useCallback(async () => {
    setGenerandoLinks(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const user = getAuth().currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) throw new Error('No autenticado');
      const res = await fetch('/api/viajes/generar-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ viajeId, socioIds: viaje?.jugadoresDesignados ?? [] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Error al generar links');
      }
      toast({ title: 'Links generados', description: 'Se enviaron los links de pago.' });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setGenerandoLinks(false);
    }
  }, [viajeId, viaje?.jugadoresDesignados, toast]);

  const handleReenviarLink = useCallback(
    async (socioId: string) => {
      try {
        const { getAuth } = await import('firebase/auth');
        const user = getAuth().currentUser;
        const token = user ? await user.getIdToken() : null;
        if (!token) throw new Error('No autenticado');
        const res = await fetch('/api/viajes/reenviar-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ viajeId, socioId }),
        });
        if (!res.ok) throw new Error('Error al reenviar');
        toast({ title: 'Link reenviado' });
      } catch (e) {
        toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
      }
    },
    [viajeId, toast]
  );

  const handleExportar = useCallback(() => {
    toast({ title: 'Próximamente', description: 'Exportación a Excel en desarrollo.' });
  }, [toast]);

  if (loading || !viaje) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const fechaSalida = viaje.fechaSalida instanceof Date ? viaje.fechaSalida : new Date();
  const fechaRegreso = viaje.fechaRegreso instanceof Date ? viaje.fechaRegreso : new Date();

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Volver a viajes</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold font-headline sm:text-3xl">{viaje.destino}</h1>
            <p className="text-sm text-muted-foreground">
              {format(fechaSalida, "d MMM yyyy", { locale: es })} —{' '}
              {format(fechaRegreso, "d MMM yyyy", { locale: es })}
            </p>
            {viaje.categoriaIds?.length ? (
              <p className="text-xs text-muted-foreground mt-1">
                Categorías: {(viaje.categoriaIds ?? [])
                  .map((id) => categorias?.find((c) => c.id === id)?.nombre ?? id)
                  .join(', ')}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-crsn-navy">
            ${(viaje.precioPorJugador ?? 0).toLocaleString('es-AR')}
          </span>
          <span className="text-sm text-muted-foreground">por jugador</span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes/${viajeId}/editar`}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Jugadores designados</CardTitle>
              <CardDescription>
                Agregá o quitá jugadores. Luego generá los links de pago.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JugadoresDesignados
                viaje={viaje}
                subcomisionId={subcomisionId}
                onGenerarLinks={handleGenerarLinks}
                generandoLinks={generandoLinks}
              />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="font-headline font-semibold">Estado de pagos</h3>
            {pagos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Designá jugadores para ver el estado de pagos.
              </p>
            ) : (
              <div className="space-y-2">
                {pagos.map((p) => {
                  const socio = sociosMap.get(p.socioId);
                  const nombre =
                    socio
                      ? `${socio.nombre ?? socio.firstName ?? ''} ${socio.apellido ?? socio.lastName ?? ''}`.trim()
                      : p.socioId;
                  const docViaje = documentacion.find((d) => d.socioId === p.socioId) ?? null;
                  return (
                    <PagoRow
                      key={p.id}
                      pago={p}
                      docViaje={docViaje}
                      nombreJugador={nombre}
                      documentacionRequerida={viaje.documentacionRequerida ?? []}
                      onReenviarLink={() => handleReenviarLink(p.socioId)}
                      onVerRecibo={
                        p.comprobanteUrl ?? p.comprobante
                          ? () => window.open(p.comprobanteUrl ?? p.comprobante, '_blank')
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <ViajeStats
            montoRecaudado={stats.montoRecaudado}
            montoTotal={stats.totalDesignados * (viaje.precioPorJugador ?? 0)}
            totalPagados={stats.totalPagados}
            totalDesignados={stats.totalDesignados}
            porcentajeRecaudado={stats.porcentajeRecaudado}
            documentacionRequerida={viaje.documentacionRequerida ?? []}
            documentacion={documentacion}
            notificasHubActivo={!!process.env.NEXT_PUBLIC_NOTIFICASHUB_ACTIVO}
          />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleExportar}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar a Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
