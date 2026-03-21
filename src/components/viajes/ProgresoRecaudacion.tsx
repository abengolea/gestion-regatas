'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface ProgresoRecaudacionProps {
  montoRecaudado: number;
  montoTotal: number;
  totalPagados: number;
  totalDesignados: number;
  porcentajeRecaudado: number;
}

export function ProgresoRecaudacion({
  montoRecaudado,
  montoTotal,
  totalPagados,
  totalDesignados,
  porcentajeRecaudado,
}: ProgresoRecaudacionProps) {
  return (
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
  );
}
