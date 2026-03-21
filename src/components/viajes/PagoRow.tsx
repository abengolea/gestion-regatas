'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PagoViaje, DocViaje, DocRequerida } from '@/lib/types/viaje';
import { Check, X, Send, FileText } from 'lucide-react';

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
};

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-crsn-orange/80 text-white',
  en_revision: 'bg-yellow-500/80 text-white',
  pagado: 'bg-green-600/90 text-white',
  rechazado: 'bg-destructive/80 text-white',
};

interface PagoRowProps {
  pago: PagoViaje;
  docViaje: DocViaje | null;
  nombreJugador: string;
  documentacionRequerida: DocRequerida[];
  onReenviarLink?: () => void;
  onVerRecibo?: () => void;
  onCargarComprobante?: () => void;
  reenviando?: boolean;
}

function DocChipInline({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
        ok ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function PagoRow({
  pago,
  docViaje,
  nombreJugador,
  documentacionRequerida,
  onReenviarLink,
  onVerRecibo,
  onCargarComprobante,
  reenviando = false,
}: PagoRowProps) {
  const iniciales = nombreJugador
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const docMap = docViaje
    ? {
        dni: docViaje.dni,
        aps: docViaje.aps,
        apf: docViaje.apf,
        autorizacion: docViaje.autorizacion,
      }
    : { dni: false, aps: false, apf: false, autorizacion: false };

  const DOC_LABELS: Record<DocRequerida, string> = {
    dni: 'DNI',
    aps: 'APS',
    apf: 'APF',
    autorizacion: 'Aut.',
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-crsn-navy text-white font-headline">
            {iniciales}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{nombreJugador}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {documentacionRequerida.map((key) => (
              <DocChipInline
                key={key}
                label={DOC_LABELS[key]}
                ok={docMap[key as keyof typeof docMap] ?? false}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge className={ESTADO_STYLES[pago.estado] ?? ''}>
          {ESTADO_LABELS[pago.estado] ?? pago.estado}
        </Badge>
        {pago.estado === 'pagado' && onVerRecibo && (
          <Button variant="outline" size="sm" onClick={onVerRecibo}>
            <FileText className="h-4 w-4 mr-1" />
            Ver recibo
          </Button>
        )}
        {pago.estado !== 'pagado' && onReenviarLink && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReenviarLink}
            disabled={reenviando}
          >
            <Send className="h-4 w-4 mr-1" />
            Reenviar link
          </Button>
        )}
        {(pago.metodoPago === 'transferencia_whatsapp' || pago.metodoPago === 'transferencia_app') && pago.estado !== 'pagado' && onCargarComprobante && (
          <Button variant="outline" size="sm" onClick={onCargarComprobante}>
            Cargar comprobante
          </Button>
        )}
      </div>
    </div>
  );
}
