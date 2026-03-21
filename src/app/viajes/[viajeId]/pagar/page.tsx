'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageCircle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const schema = z.object({
  dni: z.string().min(7, 'DNI requerido (mínimo 7 dígitos)'),
});

type FormData = z.infer<typeof schema>;

export default function PagarViajePage() {
  const params = useParams();
  const viajeId = params.viajeId as string;
  const [viajeInfo, setViajeInfo] = useState<{
    destino: string;
    fechaSalida: string;
    fechaRegreso: string;
    precioPorJugador: number;
    metodoPagoHabilitado: string[];
    cbuClub: string;
    aliasClub: string;
    bancoClub: string;
  } | null>(null);
  const [validado, setValidado] = useState<{
    socioId: string;
    nombreJugador: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [metodosDisponibles, setMetodosDisponibles] = useState<
    Array<{ nombre: string; label: string; disponible: boolean }>
  >([]);

  useEffect(() => {
    fetch('/api/pagos/disponibles')
      .then((r) => r.json())
      .then((data: Array<{ nombre: string; label: string; disponible: boolean }>) =>
        setMetodosDisponibles(Array.isArray(data) ? data : [])
      )
      .catch(() =>
        setMetodosDisponibles([
          { nombre: 'transferencia_whatsapp', label: 'Mandar comprobante por WhatsApp', disponible: true },
          { nombre: 'transferencia_app', label: 'Subir comprobante aquí', disponible: true },
        ])
      );
  }, []);

  useEffect(() => {
    fetch(`/api/viajes/${viajeId}/pagar-info`)
      .then((r) => r.json())
      .then((d) => {
        if (d.destino) setViajeInfo(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [viajeId]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onValidarDni = handleSubmit(async (data) => {
    setValidating(true);
    try {
      const res = await fetch(`/api/viajes/${viajeId}/validar-dni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: data.dni.replace(/\D/g, '') }),
      });
      const json = await res.json();
      if (json.valido) {
        setValidado({ socioId: json.socioId, nombreJugador: json.nombreJugador });
      } else {
        alert(json.message ?? 'DNI no válido');
      }
    } catch {
      alert('Error al validar. Intentá de nuevo.');
    } finally {
      setValidating(false);
    }
  });

  const waNumber = process.env.NEXT_PUBLIC_CLUB_WA_NUMBER ?? '5491112345678';
  const waUrl = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=REGATAS`;

  const handleIniciarPago = async (metodo: string) => {
    if (!validado || !viajeInfo) return;
    if (metodo === 'transferencia_whatsapp') {
      window.open(waUrl, '_blank');
      return;
    }
    if (metodo === 'transferencia_app') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setUploading(true);
        try {
          const form = new FormData();
          form.append('viajeId', viajeId);
          form.append('socioId', validado.socioId);
          form.append('imagen', file);
          const res = await fetch('/api/pagos/comprobante', {
            method: 'POST',
            body: form,
          });
          const json = await res.json();
          if (json.success) {
            alert(json.message ?? 'Comprobante enviado. Te avisamos por WhatsApp.');
          } else {
            alert(json.message ?? 'Error al subir');
          }
        } catch {
          alert('Error al subir. Intentá de nuevo.');
        } finally {
          setUploading(false);
        }
      };
      input.click();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-crsn-gray-bg">
        <Loader2 className="h-8 w-8 animate-spin text-crsn-navy" />
      </div>
    );
  }

  if (!viajeInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Viaje no encontrado</CardTitle>
            <CardDescription>El viaje no existe o no está abierto para pagos.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-crsn-gray-bg py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="font-headline text-2xl sm:text-3xl text-crsn-navy">
            Club de Regatas San Nicolás
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pago de viaje</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">{viajeInfo.destino}</CardTitle>
            <CardDescription>
              {viajeInfo.fechaSalida && format(new Date(viajeInfo.fechaSalida), "d MMM yyyy", { locale: es })}
              {' — '}
              {viajeInfo.fechaRegreso && format(new Date(viajeInfo.fechaRegreso), "d MMM yyyy", { locale: es })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!validado ? (
              <form onSubmit={onValidarDni} className="space-y-4">
                <div>
                  <Label htmlFor="dni">DNI del jugador/a</Label>
                  <Input
                    id="dni"
                    {...register('dni')}
                    placeholder="Ej: 12345678"
                    className="font-body mt-1"
                  />
                  {errors.dni && (
                    <p className="text-sm text-destructive mt-1">{errors.dni.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-crsn-orange hover:bg-crsn-orange-hover"
                  disabled={validating}
                >
                  {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continuar
                </Button>
              </form>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {validado.nombreJugador} · ${viajeInfo.precioPorJugador.toLocaleString('es-AR')}
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-sm">¿Cómo querés pagar?</p>
                  {metodosDisponibles
                    .filter(
                      (p) =>
                        !viajeInfo.metodoPagoHabilitado?.length ||
                        viajeInfo.metodoPagoHabilitado.includes(p.nombre)
                    )
                    .map((p) => (
                      <Button
                        key={p.nombre}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => p.disponible && handleIniciarPago(p.nombre)}
                        disabled={uploading || !p.disponible || validating}
                      >
                        {p.nombre === 'transferencia_whatsapp' && (
                          <MessageCircle className="mr-2 h-4 w-4" />
                        )}
                        {p.nombre === 'transferencia_app' && (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {p.nombre === 'mercadopago' && (
                          <span className="mr-2">💳</span>
                        )}
                        {p.nombre === 'santander_pay' && (
                          <span className="mr-2">🏦</span>
                        )}
                        {p.label}
                        {!p.disponible && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Próximamente
                          </span>
                        )}
                      </Button>
                    ))}
                </div>
                {(viajeInfo.cbuClub || viajeInfo.aliasClub) && (
                  <div className="rounded-lg bg-muted/50 p-4 text-sm">
                    <p className="font-medium mb-2">Datos para transferencia</p>
                    <p><span className="text-muted-foreground">CBU:</span> {viajeInfo.cbuClub || '—'}</p>
                    <p><span className="text-muted-foreground">Alias:</span> {viajeInfo.aliasClub || '—'}</p>
                    <p><span className="text-muted-foreground">Banco:</span> {viajeInfo.bancoClub || '—'}</p>
                    <p><span className="text-muted-foreground">Concepto:</span> Viaje {viajeInfo.destino} — {validado.nombreJugador}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
