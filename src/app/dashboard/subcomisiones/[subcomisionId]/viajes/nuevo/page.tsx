'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { ViajeForm } from '@/components/viajes/ViajeForm';

export default function NuevoViajePage() {
  const params = useParams();
  const subcomisionId = params.subcomisionId as string;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes`}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver a viajes</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold font-headline sm:text-3xl">Nuevo viaje</h1>
      </div>

      <ViajeForm subcomisionId={subcomisionId} />
    </div>
  );
}
