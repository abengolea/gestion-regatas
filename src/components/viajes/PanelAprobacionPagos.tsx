'use client';

import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

interface PagoEnRevision {
  viajeId: string;
  socioId: string;
  viajeDestino: string;
  nombreJugador: string;
  monto: number;
  comprobanteUrl: string;
  comprobanteFuente: 'whatsapp' | 'app';
}

interface PanelAprobacionPagosProps {
  subcomisionId: string;
}

export function PanelAprobacionPagos({ subcomisionId }: PanelAprobacionPagosProps) {
  const [pagos, setPagos] = useState<PagoEnRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprobarId, setAprobarId] = useState<string | null>(null);
  const [rechazarId, setRechazarId] = useState<string | null>(null);
  const [rechazoMotivo, setRechazoMotivo] = useState('');
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPagos = useCallback(async () => {
    if (!subcomisionId) return;
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch(
      `/api/viajes/pagos-en-revision?subcomisionId=${encodeURIComponent(subcomisionId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      setPagos(data.pagos ?? []);
    }
  }, [subcomisionId]);

  useEffect(() => {
    setLoading(true);
    fetchPagos().finally(() => setLoading(false));
  }, [fetchPagos]);

  const handleAprobar = async (viajeId: string, socioId: string) => {
    setAprobarId(`${viajeId}_${socioId}`);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('No autenticado');
      const res = await fetch('/api/pagos/aprobar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ viajeId, socioId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Error');
      }
      toast({ title: 'Pago aprobado', description: 'Se notificó al padre por WhatsApp.' });
      fetchPagos();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setAprobarId(null);
    }
  };

  const handleRechazar = async (viajeId: string, socioId: string) => {
    if (!rechazoMotivo.trim()) {
      toast({ title: 'Ingresá un motivo', variant: 'destructive' });
      return;
    }
    setRechazarId(`${viajeId}_${socioId}`);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('No autenticado');
      const res = await fetch('/api/pagos/rechazar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ viajeId, socioId, motivo: rechazoMotivo }),
      });
      if (!res.ok) throw new Error('Error');
      toast({ title: 'Pago rechazado', description: 'Se notificó al padre.' });
      setRechazarId(null);
      setRechazoMotivo('');
      fetchPagos();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
      setRechazarId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pagos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay pagos en revisión.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-headline font-semibold">Pagos en revisión</h3>
      <div className="space-y-3">
        {pagos.map((p) => {
          const key = `${p.viajeId}_${p.socioId}`;
          const isAprobando = aprobarId === key;
          const isRechazando = rechazarId === key;
          return (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback className="bg-crsn-navy text-white">
                    {p.nombreJugador.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{p.nombreJugador}</p>
                  <p className="text-sm text-muted-foreground">{p.viajeDestino}</p>
                  <Badge
                    variant="outline"
                    className={
                      p.comprobanteFuente === 'whatsapp'
                        ? 'border-green-600 text-green-700'
                        : 'border-blue-600 text-blue-700'
                    }
                  >
                    {p.comprobanteFuente === 'whatsapp' ? 'WhatsApp' : 'App'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-crsn-navy">
                  ${p.monto.toLocaleString('es-AR')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => p.comprobanteUrl && setImagenModal(p.comprobanteUrl)}
                >
                  Ver comprobante
                </Button>
                <Button
                  size="sm"
                  className="bg-crsn-orange hover:bg-crsn-orange-hover text-white"
                  onClick={() => handleAprobar(p.viajeId, p.socioId)}
                  disabled={isAprobando || isRechazando}
                >
                  {isAprobando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprobar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRechazarId(key)}
                  disabled={isAprobando || isRechazando}
                >
                  <X className="h-4 w-4" />
                  Rechazar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!rechazarId} onOpenChange={(o) => !o && setRechazarId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo del rechazo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="motivo">El padre recibirá este mensaje por WhatsApp</Label>
              <Input
                id="motivo"
                value={rechazoMotivo}
                onChange={(e) => setRechazoMotivo(e.target.value)}
                placeholder="Ej: La imagen no se ve claramente"
              />
            </div>
            <Button
              className="w-full"
              variant="destructive"
              onClick={() => {
                const [viajeId, socioId] = rechazarId?.split('_') ?? [];
                if (viajeId && socioId) handleRechazar(viajeId, socioId);
              }}
            >
              Rechazar y notificar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imagenModal} onOpenChange={(o) => !o && setImagenModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante</DialogTitle>
          </DialogHeader>
          {imagenModal && (
            <img
              src={imagenModal}
              alt="Comprobante"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
