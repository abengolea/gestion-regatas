'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import type { CategoriaViaje } from '@/lib/types/viaje';
import type { Socio } from '@/lib/types';
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
  seedCategoriasDefault,
  getCategoriaIdFromAge,
} from '@/lib/categorias-viaje';
import { getBirthDateFromPlayer, getCategoryAge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { updateDoc, doc, deleteField } from 'firebase/firestore';

interface CategoriasTabProps {
  subcomisionId: string;
}

export function CategoriasTab({ subcomisionId }: CategoriasTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaViaje | null>(null);
  const [nombre, setNombre] = useState('');
  const [tirasStr, setTirasStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const { data: categorias, loading } = useCollection<CategoriaViaje & { orden?: number }>(
    `subcomisiones/${subcomisionId}/categorias`,
    { orderBy: ['orden', 'asc'] }
  );
  const { data: socios, loading: sociosLoading } = useCollection<Socio>(
    `subcomisiones/${subcomisionId}/socios`,
    {}
  );
  const activos = useMemo(
    () =>
      (socios ?? [])
        .filter((s) => !s.archived)
        .sort((a, b) => {
          const lnA = (a.apellido ?? a.lastName ?? '').toLowerCase();
          const lnB = (b.apellido ?? b.lastName ?? '').toLowerCase();
          return lnA.localeCompare(lnB);
        }),
    [socios]
  );

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setTirasStr('A, B, C');
    setDialogOpen(true);
  };

  const openEdit = (c: CategoriaViaje) => {
    setEditing(c);
    setNombre(c.nombre);
    setTirasStr(c.tiras?.join(', ') ?? 'A, B, C');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const tiras = tirasStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!nombre.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategoria(firestore, subcomisionId, editing.id, {
          nombre: nombre.trim(),
          tiras: tiras.length > 0 ? tiras : undefined,
        });
        toast({ title: 'Categoría actualizada' });
      } else {
        await createCategoria(firestore, subcomisionId, {
          nombre: nombre.trim(),
          tiras: tiras.length > 0 ? tiras : undefined,
        });
        toast({ title: 'Categoría creada' });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: CategoriaViaje) => {
    if (!confirm(`¿Eliminar categoría ${c.nombre}?`)) return;
    try {
      await deleteCategoria(firestore, subcomisionId, c.id);
      toast({ title: 'Categoría eliminada' });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSeedDefault = async () => {
    setSeeding(true);
    try {
      await seedCategoriasDefault(firestore, subcomisionId);
      toast({ title: 'Categorías creadas', description: 'U21, U17, U15, U13, U11, U9 con tiras A, B, C' });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const assignCategoriaToSocio = async (
    socioId: string,
    categoriaId: string,
    tira?: string | null,
    silent?: boolean
  ) => {
    try {
      const ref = doc(firestore, 'subcomisiones', subcomisionId, 'socios', socioId);
      await updateDoc(ref, {
        categoriaId: categoriaId || '',
        ...(tira !== undefined ? (tira ? { tira } : { tira: deleteField() }) : {}),
      });
      if (!silent) toast({ title: 'Jugador actualizado' });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleAutoAssignByBirthDate = async () => {
    const conFecha = activos.filter((s) => getBirthDateFromPlayer(s));
    if (conFecha.length === 0) {
      toast({
        title: 'Sin fechas',
        description: 'Ningún jugador tiene fecha de nacimiento cargada.',
        variant: 'destructive',
      });
      return;
    }
    setAutoAssigning(true);
    let assigned = 0;
    try {
      for (const s of conFecha) {
        const bd = getBirthDateFromPlayer(s);
        if (!bd) continue;
        const age = getCategoryAge(bd);
        const catId = getCategoriaIdFromAge(age, listaCategorias);
        if (catId) {
          await assignCategoriaToSocio(s.id, catId, null, true);
          assigned++;
        }
      }
      toast({
        title: 'Categorías asignadas',
        description: `${assigned} de ${conFecha.length} jugadores actualizados según fecha de nacimiento.`,
      });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setAutoAssigning(false);
    }
  };

  const listaCategorias = categorias ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-headline text-xl">Categorías</CardTitle>
              <CardDescription>
                Definí categorías (ej. U21, U17) y tiras (A, B, C). Asigná jugadores a cada categoría.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeedDefault} disabled={seeding || listaCategorias.length > 0}>
                {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear U21, U17, U15, U13, U11, U9
              </Button>
              <Button size="sm" onClick={openCreate} className="bg-crsn-orange hover:bg-crsn-orange-hover">
                <Plus className="mr-2 h-4 w-4" />
                Nueva categoría
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : listaCategorias.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No hay categorías. Creá las por defecto o agregá una nueva.
            </p>
          ) : (
            <div className="space-y-3">
              {listaCategorias.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    {c.tiras?.length ? (
                      <p className="text-sm text-muted-foreground">
                        Tiras: {c.tiras.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(c)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {listaCategorias.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="font-headline text-lg">Asignar jugadores a categorías</CardTitle>
                <CardDescription>
                  Seleccioná la categoría y tira para cada jugador. U21 = 18–21 años, U17 = 16–17, U15 = 14–15, U13 = 12–13, U11 = 10–11, U9 = 9 o menos.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoAssignByBirthDate}
                disabled={autoAssigning || activos.length === 0}
              >
                {autoAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Asignar por fecha de nacimiento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sociosLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay jugadores en la subcomisión.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activos.map((s) => {
                  const nombre = `${s.nombre ?? s.firstName ?? ''} ${s.apellido ?? s.lastName ?? ''}`.trim() || s.id;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded border p-2"
                    >
                      <span className="min-w-[140px] truncate font-medium">{nombre}</span>
                      <Select
                        value={s.categoriaId ?? ''}
                        onValueChange={(v) => assignCategoriaToSocio(s.id, v)}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin categoría</SelectItem>
                          {listaCategorias.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {s.categoriaId && (() => {
                        const cat = listaCategorias.find((x) => x.id === s.categoriaId);
                        return cat?.tiras?.length ? (
                          <Select
                            value={s.tira ?? ''}
                            onValueChange={(v) =>
                              assignCategoriaToSocio(s.id, s.categoriaId!, v ? v : null)
                            }
                          >
                            <SelectTrigger className="w-[80px]">
                              <SelectValue placeholder="Tira" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">—</SelectItem>
                              {cat.tiras.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null;
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cat-nombre">Nombre (ej. U21, U17)</Label>
              <Input
                id="cat-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="U21"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cat-tiras">Tiras (opcional, separadas por coma)</Label>
              <Input
                id="cat-tiras"
                value={tirasStr}
                onChange={(e) => setTirasStr(e.target.value)}
                placeholder="A, B, C"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-crsn-orange hover:bg-crsn-orange-hover">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
