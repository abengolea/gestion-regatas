'use client';

import { Badge } from '@/components/ui/badge';
import type { DocRequerida } from '@/lib/types/viaje';
import type { DocViaje } from '@/lib/types/viaje';

const DOC_LABELS: Record<DocRequerida, string> = {
  dni: 'DNI',
  aps: 'APS',
  apf: 'APF',
  autorizacion: 'Autorización',
};

interface DocChipsProps {
  documentacionRequerida: DocRequerida[];
  documentacion: DocViaje[];
}

export function DocChips({ documentacionRequerida, documentacion }: DocChipsProps) {
  const total = documentacion.length;
  const counts = documentacionRequerida.map((key) => {
    const completos = documentacion.filter((d) => (d as unknown as Record<string, boolean>)[key] === true).length;
    return { key, completos, faltan: total - completos };
  });

  return (
    <div className="flex flex-wrap gap-2">
      {counts.map(({ key, completos, faltan }) => (
        <Badge
          key={key}
          variant={faltan === 0 ? 'default' : 'secondary'}
          className={
            faltan === 0
              ? 'bg-green-600/90 hover:bg-green-600'
              : 'bg-crsn-orange/80 hover:bg-crsn-orange'
          }
        >
          {DOC_LABELS[key]} ({completos}/{total})
          {faltan > 0 && (
            <span className="ml-1 opacity-90">— faltan {faltan}</span>
          )}
        </Badge>
      ))}
    </div>
  );
}
