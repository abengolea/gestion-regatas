'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useViaje } from '@/hooks/useViaje';
import { ViajeForm } from '@/components/viajes/ViajeForm';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditarViajePage() {
  const params = useParams();
  const subcomisionId = params.subcomisionId as string;
  const viajeId = params.viajeId as string;

  const { viaje, loading } = useViaje(viajeId);

  if (loading || !viaje) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes/${viajeId}`}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver al viaje</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold font-headline sm:text-3xl">
          Editar: {viaje.destino}
        </h1>
      </div>

      <ViajeForm subcomisionId={subcomisionId} viaje={viaje} />
    </div>
  );
}
