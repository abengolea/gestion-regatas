'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { DocChips } from './DocChips';
import type { DocRequerida } from '@/lib/types/viaje';
import type { DocViaje } from '@/lib/types/viaje';

interface ViajeStatsProps {
  montoRecaudado: number;
  montoTotal: number;
  totalPagados: number;
  totalDesignados: number;
  porcentajeRecaudado: number;
  documentacionRequerida: DocRequerida[];
  documentacion: DocViaje[];
  notificasHubActivo?: boolean;
}

export function ViajeStats({
  montoRecaudado,
  montoTotal,
  totalPagados,
  totalDesignados,
  porcentajeRecaudado,
  documentacionRequerida,
  documentacion,
  notificasHubActivo = false,
}: ViajeStatsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Recaudación</span>
              <span className="text-muted-foreground">
                ${montoRecaudado.toLocaleString('es-AR')} / $
                {montoTotal.toLocaleString('es-AR')}
              </span>
            </div>
            <Progress value={porcentajeRecaudado} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {totalPagados} de {totalDesignados} jugadores pagaron
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-headline">Documentación</CardTitle>
        </CardHeader>
        <CardContent>
          <DocChips
            documentacionRequerida={documentacionRequerida}
            documentacion={documentacion}
          />
        </CardContent>
      </Card>

      {notificasHubActivo && (
        <Badge
          variant="outline"
          className="w-full justify-center border-green-600 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400"
        >
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          WhatsApp activo vía NotificasHub
        </Badge>
      )}
    </div>
  );
}
