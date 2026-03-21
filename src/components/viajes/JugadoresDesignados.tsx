'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import type { Socio } from '@/lib/types';
import type { CategoriaViaje, Viaje } from '@/lib/types/viaje';
import { agregarJugadorAlViaje, quitarJugadorDelViaje } from '@/lib/viajes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface JugadoresDesignadosProps {
  viaje: Viaje;
  subcomisionId: string;
  onGenerarLinks?: () => void;
  generandoLinks?: boolean;
}

export function JugadoresDesignados({
  viaje,
  subcomisionId,
  onGenerarLinks,
  generandoLinks = false,
}: JugadoresDesignadosProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: socios, loading: sociosLoading } = useCollection<Socio>(
    `subcomisiones/${subcomisionId}/socios`,
    { orderBy: ['apellido', 'asc'] }
  );
  const { data: categorias } = useCollection<CategoriaViaje & { orden?: number }>(
    `subcomisiones/${subcomisionId}/categorias`,
    { orderBy: ['orden', 'asc'] }
  );

  const activos = (socios ?? []).filter((s) => !s.archived);
  const designados = new Set(viaje.jugadoresDesignados ?? []);
  const categoriasViaje = viaje.categoriaIds ?? [];
  const listaCategorias = categorias ?? [];

  const sociosPorCategoria = useMemo(() => {
    if (categoriasViaje.length === 0) return null;
    const map: Record<string, Socio[]> = {};
    for (const catId of categoriasViaje) {
      map[catId] = activos.filter((s) => s.categoriaId === catId);
    }
    map['_otros'] = activos.filter((s) => !s.categoriaId || !categoriasViaje.includes(s.categoriaId ?? ''));
    return map;
  }, [activos, categoriasViaje]);

  const designadosPorCategoria = useMemo(() => {
    const jpc = viaje.jugadoresPorCategoria ?? {};
    const result: Record<string, Set<string>> = {};
    for (const catId of categoriasViaje) {
      result[catId] = new Set(jpc[catId] ?? []);
    }
    return result;
  }, [viaje.jugadoresPorCategoria, categoriasViaje]);

  const toggleDesignado = async (socioId: string, checked: boolean, categoriaId?: string) => {
    if (viaje.estado === 'cerrado' || viaje.estado === 'finalizado') {
      toast({ title: 'Viaje cerrado', description: 'No se pueden modificar jugadores.', variant: 'destructive' });
      return;
    }
    setUpdating(socioId);
    try {
      if (checked) {
        await agregarJugadorAlViaje(firestore, viaje, socioId, categoriaId);
        toast({ title: 'Jugador citado', description: 'Se creó el registro de pago.' });
      } else {
        await quitarJugadorDelViaje(
          firestore,
          viaje.id,
          socioId,
          viaje.jugadoresDesignados ?? [],
          viaje,
          categoriaId
        );
        toast({ title: 'Jugador quitado', description: 'Se eliminó del viaje.' });
      }
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const canEdit = viaje.estado === 'borrador' || viaje.estado === 'abierto';

  const getNombreCategoria = (id: string) =>
    id === '_otros' ? 'Otros / Sin categoría' : listaCategorias.find((c) => c.id === id)?.nombre ?? id;

  if (sociosLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay jugadores en la subcomisión.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-headline text-lg font-semibold">Jugadores citados por categoría</h3>
        {designados.size > 0 && onGenerarLinks && canEdit && (
          <Button
            size="sm"
            onClick={onGenerarLinks}
            disabled={generandoLinks}
            className="bg-crsn-orange hover:bg-crsn-orange-hover"
          >
            {generandoLinks && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar links de pago
          </Button>
        )}
      </div>

      {categoriasViaje.length > 0 && sociosPorCategoria ? (
        <div className="space-y-6">
          {[...categoriasViaje, '_otros'].map((catId) => {
            const sociosCat = sociosPorCategoria[catId] ?? [];
            const designadosCat = designadosPorCategoria[catId] ?? new Set<string>();
            return (
              <div key={catId} className="rounded-lg border p-4">
                <h4 className="font-headline font-medium mb-3 flex items-center gap-2">
                  {getNombreCategoria(catId)}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({designadosCat.size} citados)
                  </span>
                </h4>
                <div className="space-y-2">
                  {sociosCat.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay jugadores en esta categoría.</p>
                  ) : (
                    sociosCat.map((s) => {
                      const nombre = `${s.nombre ?? s.firstName ?? ''} ${s.apellido ?? s.lastName ?? ''}`.trim() || s.id;
                      const checked = designadosCat.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded border p-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Checkbox
                              id={`socio-${catId}-${s.id}`}
                              checked={checked}
                              onCheckedChange={(c) => toggleDesignado(s.id, !!c, catId)}
                              disabled={!canEdit || updating === s.id}
                            />
                            <label htmlFor={`socio-${catId}-${s.id}`} className="cursor-pointer font-medium truncate">
                              {nombre}
                              {s.tira && <span className="text-muted-foreground ml-1">({s.tira})</span>}
                            </label>
                          </div>
                          {updating === s.id && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-2">
            Seleccioná categorías en el formulario del viaje para citar jugadores por categoría.
          </p>
          {activos.map((s) => {
            const nombre = `${s.nombre ?? s.firstName ?? ''} ${s.apellido ?? s.lastName ?? ''}`.trim() || s.id;
            const checked = designados.has(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Checkbox
                    id={`socio-${s.id}`}
                    checked={checked}
                    onCheckedChange={(c) => toggleDesignado(s.id, !!c)}
                    disabled={!canEdit || updating === s.id}
                  />
                  <label htmlFor={`socio-${s.id}`} className="cursor-pointer font-medium truncate">
                    {nombre}
                  </label>
                </div>
                {updating === s.id && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
