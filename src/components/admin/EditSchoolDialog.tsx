"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Edit } from "lucide-react";
import { useFirestore, useUserProfile, useCollection } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { writeAuditLog } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AddSubcomisionUserDialog } from "./AddSchoolUserDialog";
import { EditSubcomisionUserDialog } from "./EditSchoolUserDialog";
import type { Subcomision, SubcomisionUser } from "@/lib/types";

const schoolSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
});

interface EditSubcomisionDialogProps {
  school: Subcomision;
  children: React.ReactNode; // To use as a trigger
}

const ROLE_LABELS: Record<SubcomisionUser["role"], string> = {
  admin_subcomision: "Administrador",
  encargado_deportivo: "Entrenador",
  editor: "Editor",
  viewer: "Visor",
  player: "Jugador",
};

export function EditSubcomisionDialog({ school, children }: EditSubcomisionDialogProps) {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUserProfile();
  const { toast } = useToast();
  const { data: users, loading: usersLoading } = useCollection<SubcomisionUser>(
    open ? `subcomisiones/${school.id}/users` : "",
    { orderBy: ["displayName", "asc"] }
  );

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: school.name,
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof schoolSchema>) {
    const schoolRef = doc(firestore, 'subcomisiones', school.id);
    
    try {
      await updateDoc(schoolRef, {
        name: values.name,
      });

      if (user?.uid && user?.email) {
        await writeAuditLog(firestore, user.email, user.uid, {
          action: "school.update",
          resourceType: "school",
          resourceId: school.id,
          subcomisionId: school.id,
          details: values.name,
        });
      }

      toast({
        title: "¡Escuela actualizada!",
        description: `Los datos de la subcomisión "${values.name}" han sido guardados.`,
      });
      setOpen(false);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error al actualizar",
            description: "No se pudieron guardar los cambios. Por favor, revisa tus permisos e inténtalo de nuevo.",
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Subcomisión</DialogTitle>
          <DialogDescription>
            Modifica los datos de la subcomisión.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre de la Subcomisión</FormLabel>
                    <FormControl>
                        <Input placeholder="Ej: Remo U17" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Responsables</h3>
                <AddSubcomisionUserDialog subcomisionId={school.id} />
              </div>
              {usersLoading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : !users || users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay responsables asignados.</p>
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={u.role === "admin_subcomision" ? "default" : "secondary"}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                        <EditSubcomisionUserDialog subcomisionId={school.id} user={u}>
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar rol</span>
                          </Button>
                        </EditSubcomisionUserDialog>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
