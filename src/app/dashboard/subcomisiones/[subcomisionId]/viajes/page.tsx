'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useViajes } from '@/hooks/useViaje';
import { PanelAprobacionPagos } from '@/components/viajes/PanelAprobacionPagos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Plus, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  finalizado: 'Finalizado',
};

const ESTADO_VARIANTS: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  borrador: 'secondary',
  abierto: 'default',
  cerrado: 'outline',
  finalizado: 'secondary',
};

export default function ViajesListPage() {
  const params = useParams();
  const subcomisionId = params.subcomisionId as string;
  const { viajes, loading } = useViajes(subcomisionId);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/subcomisiones/${subcomisionId}`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <h1 className="text-xl font-bold font-headline sm:text-3xl">Viajes</h1>
        </div>
        <Button asChild className="bg-crsn-orange hover:bg-crsn-orange-hover">
          <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes/nuevo`}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo viaje
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-headline">Pagos pendientes de aprobar</CardTitle>
              <CardDescription>Aprobá o rechazá comprobantes enviados por WhatsApp o desde la app.</CardDescription>
            </CardHeader>
            <CardContent>
              <PanelAprobacionPagos subcomisionId={subcomisionId} />
            </CardContent>
          </Card>
          {viajes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Sin viajes
            </CardTitle>
            <CardDescription>
              Aún no hay viajes cargados. Creá uno para gestionar pagos y documentación.
            </CardDescription>
            <Button asChild className="mt-2 w-fit">
              <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes/nuevo`}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer viaje
              </Link>
            </Button>
          </CardHeader>
        </Card>
          ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {viajes.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/subcomisiones/${subcomisionId}/viajes/${v.id}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-headline line-clamp-1">
                      {v.destino}
                    </CardTitle>
                    <Badge variant={ESTADO_VARIANTS[v.estado] ?? 'secondary'}>
                      {ESTADO_LABELS[v.estado] ?? v.estado}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {format(
                      v.fechaSalida instanceof Date ? v.fechaSalida : new Date(),
                      "d MMM yyyy",
                      { locale: es }
                    )}{' '}
                    — {format(v.fechaRegreso instanceof Date ? v.fechaRegreso : new Date(), "d MMM yyyy", { locale: es })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm font-medium text-foreground">
                    ${(v.precioPorJugador ?? 0).toLocaleString('es-AR')} por jugador
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.jugadoresDesignados?.length ?? 0} jugadores designados
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  );
}
