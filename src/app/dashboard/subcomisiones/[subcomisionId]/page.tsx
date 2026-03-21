'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useUserProfile } from '@/firebase';
import type { Subcomision } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Shield, Users, MapPin, Tags } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SubcomisionUsersList } from '@/components/admin/SchoolUsersList';
import { CategoriasTab } from '@/components/viajes/CategoriasTab';
import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayerTable } from '@/components/players/PlayerTable';

export default function SubcomisionDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const subcomisionId = params.subcomisionId as string;
  const { isSuperAdmin, profile, isReady: profileReady } = useUserProfile();

  const { data: school, loading: schoolLoading } = useDoc<Subcomision>(
    `subcomisiones/${subcomisionId}`
  );

  const isLoading = schoolLoading || !profileReady;
  const canManageSchool =
    isSuperAdmin || (profile?.role === 'admin_subcomision' && profile?.activeSchoolId === subcomisionId);

  useEffect(() => {
    if (!isLoading && !canManageSchool) {
      router.replace('/dashboard');
    }
  }, [isLoading, canManageSchool, router]);

  if (isLoading || !canManageSchool) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-1/3" />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex gap-2 sm:gap-4 min-w-0 items-center">
        <Button variant="outline" size="icon" asChild className="shrink-0">
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver al panel</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight font-headline truncate sm:text-3xl">
          {school?.name}
        </h1>
      </div>

      {!school ? (
        <Card>
          <CardHeader>
            <CardTitle>Subcomisión no encontrada</CardTitle>
            <CardDescription>
              La subcomisión que buscás no existe o fue eliminada.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1 p-1 h-auto md:h-10 bg-card">
            <TabsTrigger value="users" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5">
              <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="truncate">Responsables</span>
            </TabsTrigger>
            <TabsTrigger value="players" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5">
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="truncate">Jugadores</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5">
              <Tags className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
              <span className="truncate">Categorías</span>
            </TabsTrigger>
            <TabsTrigger value="viajes" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5" asChild>
              <Link href={`/dashboard/subcomisiones/${subcomisionId}/viajes`}>
                <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                <span className="truncate">Viajes</span>
              </Link>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <SubcomisionUsersList subcomisionId={subcomisionId} />
          </TabsContent>
          <TabsContent value="categorias">
            <CategoriasTab subcomisionId={subcomisionId} />
          </TabsContent>
          <TabsContent value="players">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg sm:text-xl">Plantel de Jugadores</CardTitle>
                <CardDescription>Gestioná los jugadores de esta subcomisión.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <PlayerTable subcomisionId={subcomisionId} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
