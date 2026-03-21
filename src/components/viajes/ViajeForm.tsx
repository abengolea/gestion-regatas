'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase';
import { createViaje, updateViaje } from '@/lib/viajes';
import type { DocRequerida, MetodoPagoKey, Viaje } from '@/lib/types/viaje';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

const DOC_LABELS: Record<DocRequerida, string> = {
  dni: 'DNI',
  aps: 'APS (apto físico simple)',
  apf: 'APF (apto físico federado)',
  autorizacion: 'Autorización firmada',
};

const METODO_PAGO_KEYS = ['transferencia_whatsapp', 'transferencia_app', 'mercadopago', 'santander_pay'] as const;
const METODO_PAGO_LABELS: Record<string, string> = {
  transferencia_whatsapp: 'Transferencia + comprobante por WhatsApp',
  transferencia_app: 'Transferencia + comprobante desde la app',
  mercadopago: 'Mercado Pago (próximamente)',
  santander_pay: 'Santander Pay (próximamente)',
};

const schema = z.object({
  destino: z.string().min(1, 'Destino requerido'),
  descripcion: z.string().optional(),
  fechaSalida: z.string().min(1, 'Fecha de salida requerida'),
  fechaRegreso: z.string().min(1, 'Fecha de regreso requerida'),
  precioPorJugador: z.coerce.number().min(0, 'Precio debe ser mayor o igual a 0'),
  metodoPago: z.enum(['mp', 'transferencia', 'ambos']),
  cbuClub: z.string().optional(),
  aliasClub: z.string().optional(),
  transferencia_whatsapp: z.boolean().optional(),
  transferencia_app: z.boolean().optional(),
  mercadopago: z.boolean().optional(),
  santander_pay: z.boolean().optional(),
  vencimientoPago: z.string().min(1, 'Vencimiento de pago requerido'),
  categoriaIds: z.array(z.string()).optional(),
  dni: z.boolean().optional(),
  aps: z.boolean().optional(),
  apf: z.boolean().optional(),
  autorizacion: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface ViajeFormProps {
  subcomisionId: string;
  viaje?: Viaje | null;
}

export function ViajeForm({ subcomisionId, viaje }: ViajeFormProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const { data: categorias } = useCollection<{ id: string; nombre: string }>(
    `subcomisiones/${subcomisionId}/categorias`,
    { orderBy: ['orden', 'asc'] }
  );

  const toDateStr = (d: Date | { toDate?: () => Date }) => {
    if (!d) return '';
    const date = d instanceof Date ? d : (d as { toDate: () => Date }).toDate?.();
    if (!date) return '';
    return date.toISOString().slice(0, 10);
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: viaje
      ? {
          destino: viaje.destino,
          descripcion: viaje.descripcion ?? '',
          fechaSalida: toDateStr(viaje.fechaSalida),
          fechaRegreso: toDateStr(viaje.fechaRegreso),
          precioPorJugador: viaje.precioPorJugador,
          metodoPago: viaje.metodoPago ?? 'ambos',
          cbuClub: viaje.cbuClub ?? '',
          aliasClub: viaje.aliasClub ?? '',
          transferencia_whatsapp: viaje.metodoPagoHabilitado?.includes('transferencia_whatsapp') ?? true,
          transferencia_app: viaje.metodoPagoHabilitado?.includes('transferencia_app') ?? true,
          mercadopago: viaje.metodoPagoHabilitado?.includes('mercadopago') ?? false,
          santander_pay: viaje.metodoPagoHabilitado?.includes('santander_pay') ?? false,
          vencimientoPago: toDateStr(viaje.vencimientoPago),
          categoriaIds: viaje.categoriaIds ?? [],
          dni: viaje.documentacionRequerida?.includes('dni'),
          aps: viaje.documentacionRequerida?.includes('aps'),
          apf: viaje.documentacionRequerida?.includes('apf'),
          autorizacion: viaje.documentacionRequerida?.includes('autorizacion'),
        }
      : {
          metodoPago: 'ambos',
          cbuClub: '',
          aliasClub: '',
          transferencia_whatsapp: true,
          transferencia_app: true,
          mercadopago: false,
          santander_pay: false,
          categoriaIds: [],
        },
  });

  const watchedDocs = watch(['dni', 'aps', 'apf', 'autorizacion']);
  const metodoPagoHabilitadoFromForm = (): { metodoPagoHabilitado: MetodoPagoKey[]; metodoPago: 'mp' | 'transferencia' | 'ambos' } => {
    const hab = METODO_PAGO_KEYS.filter((k) => watch(k)) as MetodoPagoKey[];
    const metodoPagoHabilitado = hab.length > 0 ? hab : (['transferencia_whatsapp', 'transferencia_app'] as MetodoPagoKey[]);
    const metodoPago = metodoPagoHabilitado.includes('mercadopago')
      ? 'mp'
      : metodoPagoHabilitado.length >= 2
        ? 'ambos'
        : 'transferencia';
    return { metodoPagoHabilitado, metodoPago };
  };

  const docRequeridaFromForm = (): DocRequerida[] => {
    const req: DocRequerida[] = [];
    if (watchedDocs[0]) req.push('dni');
    if (watchedDocs[1]) req.push('aps');
    if (watchedDocs[2]) req.push('apf');
    if (watchedDocs[3]) req.push('autorizacion');
    return req;
  };

  const onGuardarBorrador = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid ?? '';
      if (viaje) {
        const { metodoPagoHabilitado, metodoPago } = metodoPagoHabilitadoFromForm();
        await updateViaje(firestore, viaje.id, {
          destino: data.destino,
          descripcion: data.descripcion || undefined,
          fechaSalida: new Date(data.fechaSalida),
          fechaRegreso: new Date(data.fechaRegreso),
          precioPorJugador: data.precioPorJugador,
          metodoPago,
          metodoPagoHabilitado,
          cbuClub: data.cbuClub?.trim() || undefined,
          aliasClub: data.aliasClub?.trim() || undefined,
          vencimientoPago: new Date(data.vencimientoPago),
          documentacionRequerida: docRequeridaFromForm(),
          categoriaIds: data.categoriaIds ?? [],
          estado: 'borrador',
        });
        toast({ title: 'Borrador actualizado', description: 'El viaje se guardó correctamente.' });
        router.push(`/dashboard/subcomisiones/${subcomisionId}/viajes/${viaje.id}`);
      } else {
        const { metodoPagoHabilitado, metodoPago } = metodoPagoHabilitadoFromForm();
        const id = await createViaje(firestore, {
          subcomisionId,
          destino: data.destino,
          descripcion: data.descripcion,
          fechaSalida: new Date(data.fechaSalida),
          fechaRegreso: new Date(data.fechaRegreso),
          precioPorJugador: data.precioPorJugador,
          metodoPago,
          metodoPagoHabilitado,
          cbuClub: data.cbuClub?.trim() || undefined,
          aliasClub: data.aliasClub?.trim() || undefined,
          vencimientoPago: new Date(data.vencimientoPago),
          documentacionRequerida: docRequeridaFromForm(),
          categoriaIds: data.categoriaIds ?? [],
          creadoPor: uid,
        });
        toast({ title: 'Borrador creado', description: 'El viaje se guardó correctamente.' });
        router.push(`/dashboard/subcomisiones/${subcomisionId}/viajes/${id}`);
      }
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  });

  const onPublicar = handleSubmit(async (data) => {
    setPublishing(true);
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid ?? '';
      if (viaje) {
        const { metodoPagoHabilitado, metodoPago } = metodoPagoHabilitadoFromForm();
        await updateViaje(firestore, viaje.id, {
          destino: data.destino,
          descripcion: data.descripcion || undefined,
          fechaSalida: new Date(data.fechaSalida),
          fechaRegreso: new Date(data.fechaRegreso),
          precioPorJugador: data.precioPorJugador,
          metodoPago,
          metodoPagoHabilitado,
          cbuClub: data.cbuClub?.trim() || undefined,
          aliasClub: data.aliasClub?.trim() || undefined,
          vencimientoPago: new Date(data.vencimientoPago),
          documentacionRequerida: docRequeridaFromForm(),
          categoriaIds: data.categoriaIds ?? [],
          estado: 'abierto',
        });
        toast({ title: 'Viaje publicado', description: 'El viaje está abierto para pagos.' });
        router.push(`/dashboard/subcomisiones/${subcomisionId}/viajes/${viaje.id}`);
      } else {
        const { metodoPagoHabilitado, metodoPago } = metodoPagoHabilitadoFromForm();
        const id = await createViaje(firestore, {
          subcomisionId,
          destino: data.destino,
          descripcion: data.descripcion,
          fechaSalida: new Date(data.fechaSalida),
          fechaRegreso: new Date(data.fechaRegreso),
          precioPorJugador: data.precioPorJugador,
          metodoPago,
          metodoPagoHabilitado,
          cbuClub: data.cbuClub?.trim() || undefined,
          aliasClub: data.aliasClub?.trim() || undefined,
          vencimientoPago: new Date(data.vencimientoPago),
          documentacionRequerida: docRequeridaFromForm(),
          categoriaIds: data.categoriaIds ?? [],
          creadoPor: uid,
        });
        await updateViaje(firestore, id, { estado: 'abierto' });
        toast({ title: 'Viaje publicado', description: 'El viaje está abierto para pagos.' });
        router.push(`/dashboard/subcomisiones/${subcomisionId}/viajes/${id}`);
      }
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  });

  return (
    <form className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Datos del viaje</CardTitle>
          <CardDescription>Completá la información del viaje.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="destino">Destino</Label>
            <Input
              id="destino"
              {...register('destino')}
              placeholder="Ej: Mar del Plata"
              className="font-body"
            />
            {errors.destino && (
              <p className="text-sm text-destructive">{errors.destino.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              {...register('descripcion')}
              placeholder="Información adicional del viaje..."
              rows={3}
              className="font-body"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaSalida">Fecha de salida</Label>
              <Input
                id="fechaSalida"
                type="date"
                {...register('fechaSalida')}
                className="font-body"
              />
              {errors.fechaSalida && (
                <p className="text-sm text-destructive">{errors.fechaSalida.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaRegreso">Fecha de regreso</Label>
              <Input
                id="fechaRegreso"
                type="date"
                {...register('fechaRegreso')}
                className="font-body"
              />
              {errors.fechaRegreso && (
                <p className="text-sm text-destructive">{errors.fechaRegreso.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="precioPorJugador">Precio por jugador (ARS)</Label>
              <Input
                id="precioPorJugador"
                type="number"
                min={0}
                {...register('precioPorJugador')}
                className="font-body"
              />
              {errors.precioPorJugador && (
                <p className="text-sm text-destructive">{errors.precioPorJugador.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimientoPago">Vencimiento de pago</Label>
              <Input
                id="vencimientoPago"
                type="date"
                {...register('vencimientoPago')}
                className="font-body"
              />
              {errors.vencimientoPago && (
                <p className="text-sm text-destructive">{errors.vencimientoPago.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cbuClub">CBU del club (opcional)</Label>
              <Input
                id="cbuClub"
                {...register('cbuClub')}
                placeholder="Usa CLUB_CBU si no se indica"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliasClub">Alias del club (opcional)</Label>
              <Input
                id="aliasClub"
                {...register('aliasClub')}
                placeholder="Usa CLUB_ALIAS si no se indica"
                className="font-body"
              />
            </div>
          </div>

          {categorias && categorias.length > 0 && (
            <div className="space-y-3">
              <Label>Categorías del viaje</Label>
              <p className="text-sm text-muted-foreground">Seleccioná una o más categorías. Los jugadores se citarán por categoría.</p>
              <div className="flex flex-wrap gap-4">
                {categorias.map((c) => {
                  const ids = watch('categoriaIds') ?? [];
                  const checked = ids.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${c.id}`}
                        checked={checked}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...(ids ?? []), c.id]
                            : (ids ?? []).filter((x) => x !== c.id);
                          setValue('categoriaIds', next);
                        }}
                      />
                      <Label htmlFor={`cat-${c.id}`} className="font-normal cursor-pointer">
                        {c.nombre}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label>Métodos de pago habilitados</Label>
            <div className="flex flex-col gap-2">
              {METODO_PAGO_KEYS.map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={watch(key) ?? false}
                    onCheckedChange={(checked) => setValue(key, !!checked)}
                    disabled={key === 'mercadopago' || key === 'santander_pay'}
                  />
                  <Label htmlFor={key} className={`font-normal cursor-pointer ${(key === 'mercadopago' || key === 'santander_pay') ? 'text-muted-foreground' : ''}`}>
                    {METODO_PAGO_LABELS[key]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Documentación requerida</Label>
            <div className="flex flex-wrap gap-4">
              {(['dni', 'aps', 'apf', 'autorizacion'] as DocRequerida[]).map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={watchedDocs[['dni', 'aps', 'apf', 'autorizacion'].indexOf(key)] ?? false}
                    onCheckedChange={(checked) => setValue(key, !!checked)}
                  />
                  <Label htmlFor={key} className="font-normal cursor-pointer">
                    {DOC_LABELS[key]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onGuardarBorrador}
          disabled={saving || publishing}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar borrador
        </Button>
        <Button
          type="button"
          onClick={onPublicar}
          disabled={saving || publishing}
          className="bg-crsn-orange hover:bg-crsn-orange-hover"
        >
          {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publicar viaje
        </Button>
      </div>
    </form>
  );
}
