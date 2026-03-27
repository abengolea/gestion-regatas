"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useUserProfile, useDoc } from "@/firebase";
import type { Subcomision } from "@/lib/types";
import type { SubcomisionModuleKey } from "@/lib/types";
import { isSubcomisionModuleEnabled } from "@/lib/subcomision-modules";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SubcomisionModuleGuardProps = {
  moduleKey: SubcomisionModuleKey;
  /** Prioridad sobre `activeSchoolId` del perfil (ej. ruta `/subcomisiones/[id]/viajes`). */
  schoolId?: string | null;
  children: React.ReactNode;
};

export function SubcomisionModuleGuard({
  moduleKey,
  schoolId: schoolIdProp,
  children,
}: SubcomisionModuleGuardProps) {
  const { activeSchoolId, isReady, isSuperAdmin, profile } = useUserProfile();
  const schoolId =
    schoolIdProp ??
    (profile?.role === "player" ? profile.activeSchoolId : undefined) ??
    activeSchoolId ??
    null;

  const docPath = schoolId ? `subcomisiones/${schoolId}` : "";
  const { data: sub, loading } = useDoc<Subcomision>(!isSuperAdmin && docPath ? docPath : "");

  if (!isReady) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (!schoolId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin subcomisión</CardTitle>
          <CardDescription>No hay una sede asociada a tu usuario.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSubcomisionModuleEnabled(sub?.moduleFlags, moduleKey)) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Función no disponible</CardTitle>
          <CardDescription>
            Esta funcionalidad está desactivada para tu subcomisión. Si la necesitás, contactá al
            gerente del club.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
