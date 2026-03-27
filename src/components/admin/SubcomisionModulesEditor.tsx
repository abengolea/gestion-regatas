"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useFirestore, useUserProfile } from "@/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, SlidersHorizontal } from "lucide-react";
import {
  SUBCOMISION_MODULE_DEFINITIONS,
  isSubcomisionModuleEnabled,
} from "@/lib/subcomision-modules";
import type { Subcomision, SubcomisionModuleKey } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type SubcomisionModulesEditorProps = {
  schoolId: string;
  school: Subcomision | null;
  schoolLoading: boolean;
};

export function SubcomisionModulesEditor({
  schoolId,
  school,
  schoolLoading,
}: SubcomisionModulesEditorProps) {
  const firestore = useFirestore();
  const { user, isSuperAdmin } = useUserProfile();
  const { toast } = useToast();
  const [updatingKey, setUpdatingKey] = useState<SubcomisionModuleKey | null>(null);
  const [optimistic, setOptimistic] = useState<Subcomision["moduleFlags"] | undefined>(undefined);

  useEffect(() => {
    setOptimistic(undefined);
  }, [school?.moduleFlags]);

  const flags = optimistic ?? school?.moduleFlags;

  const setEnabled = async (key: SubcomisionModuleKey, enabled: boolean) => {
    if (!user?.uid || !isSuperAdmin) return;
    setUpdatingKey(key);
    const prev = optimistic ?? school?.moduleFlags;
    setOptimistic({ ...school?.moduleFlags, ...prev, [key]: enabled });
    try {
      const ref = doc(firestore, "subcomisiones", schoolId);
      await updateDoc(ref, {
        [`moduleFlags.${key}`]: enabled,
      });
      setOptimistic(undefined);
      toast({
        title: enabled ? "Módulo activado" : "Módulo desactivado",
        description: `Los usuarios de «${school?.name ?? "esta subcomisión"}» verán el cambio al recargar.`,
      });
    } catch (e) {
      setOptimistic(prev);
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Reintentá o revisá tu conexión.",
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  if (!isSuperAdmin || !schoolId) {
    return null;
  }

  if (schoolLoading || !school) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <SlidersHorizontal className="h-5 w-5" />
          Funcionalidades de la subcomisión
        </CardTitle>
        <CardDescription>
          Desactivá lo que esta sede no va a usar (por ejemplo asistencia u otras secciones). Los
          jugadores y el staff dejan de ver esas pantallas y menús. Por defecto todo sigue activo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SUBCOMISION_MODULE_DEFINITIONS.map((def) => {
          const enabled = isSubcomisionModuleEnabled(flags, def.key);
          const busy = updatingKey === def.key;
          return (
            <div
              key={def.key}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4"
            >
              <div className="space-y-1 min-w-0 pr-4">
                <Label htmlFor={`mod-${def.key}`} className="text-base font-medium">
                  {def.label}
                </Label>
                <p className="text-sm text-muted-foreground">{def.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                <Switch
                  id={`mod-${def.key}`}
                  checked={enabled}
                  disabled={busy}
                  onCheckedChange={(v) => void setEnabled(def.key, v)}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
