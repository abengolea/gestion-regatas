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
import { Loader2, PlusCircle, UserPlus } from "lucide-react";
import { useFirestore, useUserProfile } from "@/firebase";
import { collection, doc, writeBatch, Timestamp } from "firebase/firestore";
import { writeAuditLog } from "@/lib/audit";
import { getAuth, createUserWithEmailAndPassword, updateProfile, deleteUser } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirebaseConfig } from "@/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";

const schoolSchema = z
  .object({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    adminDisplayName: z.string().min(3, "El nombre del administrador es requerido."),
    adminEmail: z.string().email("El correo electrónico no es válido."),
    adminEmailConfirm: z.string().email("El correo electrónico no es válido."),
    adminPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  })
  .refine((data) => data.adminEmail === data.adminEmailConfirm, {
    message: "Los correos electrónicos no coinciden.",
    path: ["adminEmailConfirm"],
  });

export function CreateSubcomisionDialog() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUserProfile();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: "",
      adminDisplayName: "",
      adminEmail: "",
      adminEmailConfirm: "",
      adminPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof schoolSchema>) {
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(getFirebaseConfig(), tempAppName);
    const tempAuth = getAuth(tempApp);
    let newUser: import("firebase/auth").User | null = null; // Para rollback si el batch falla

    try {
      // 1. Crear el usuario en Auth primero (si falla, no escribimos nada en Firestore)
      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.adminEmail, values.adminPassword);
      newUser = userCredential.user;
      await updateProfile(newUser, { displayName: values.adminDisplayName });

      // 2. Batch atómico: subcomisión + usuario + platformUser. Si falla, no se escribe NADA.
      const batch = writeBatch(firestore);
      const newSchoolRef = doc(collection(firestore, 'subcomisiones'));
      const schoolData = {
          name: values.name,
          city: "",
          province: "",
          address: "",
          status: 'active' as const,
          createdAt: Timestamp.now(),
      };
      batch.set(newSchoolRef, schoolData);

      const schoolUserRef = doc(firestore, 'subcomisiones', newSchoolRef.id, 'users', newUser.uid);
      const schoolUserData = {
          displayName: values.adminDisplayName,
          email: (values.adminEmail ?? '').trim().toLowerCase(),
          role: 'admin_subcomision' as const,
      };
      batch.set(schoolUserRef, schoolUserData);

      const platformUserRef = doc(firestore, 'platformUsers', newUser.uid);
      const platformUserData = {
          email: (values.adminEmail ?? '').trim().toLowerCase(),
          gerente_club: false,
          createdAt: Timestamp.now()
      };
      batch.set(platformUserRef, platformUserData);

      await batch.commit();

      // 3. Audit log (no bloquea: si falla, igual mostramos éxito)
      if (user?.uid && user?.email) {
        try {
          await writeAuditLog(firestore, user.email, user.uid, {
            action: "school.create",
            resourceType: "school",
            resourceId: newSchoolRef.id,
            details: values.name,
          });
        } catch {
          // Ignorar fallo del audit log
        }
      }

      toast({
          title: "¡Éxito!",
          description: `Se creó la subcomisión "${values.name}" y se asignó a ${values.adminEmail} como responsable.`,
      });
      form.reset();
      setOpen(false);

    } catch (error: any) {
      // Rollback: si creamos el usuario en Auth pero el batch falló, eliminarlo para no dejar huérfanos
      if (newUser) {
        try {
          await deleteUser(newUser);
        } catch {
          // Si falla el delete, el usuario queda huérfano en Auth (mejor que subcomisión sin admin)
        }
      }
        let title = "Error";
        let description = "Ocurrió un error inesperado.";
        const code = error?.code ?? "";
        const msg = error?.message ?? "";

        if (code.startsWith("auth/")) {
            title = "Error de Autenticación";
            if (code === "auth/email-already-in-use") {
                description = "El email del administrador ya está registrado. Usá otro email o eliminá el usuario desde Firebase Console → Autenticación.";
            } else if (code === "auth/weak-password") {
                description = "La contraseña es demasiado débil. Mínimo 6 caracteres.";
            } else if (code === "auth/operation-not-allowed") {
                description = "El proveedor Email/Password no está habilitado. En Firebase Console → Autenticación → Método de inicio de sesión → habilitá «Correo electrónico/contraseña».";
            } else if (code === "auth/invalid-email") {
                description = "El email ingresado no es válido.";
            } else if (code === "auth/too-many-requests") {
                description = "Demasiados intentos. Esperá unos minutos e intentá de nuevo.";
            } else {
                description = msg || "Revisá que Email/Password esté habilitado en Firebase Console.";
            }
        } else {
            title = "Error de Base de Datos";
            description = msg || "No se pudo crear la subcomisión. Revisá permisos de Firestore.";
        }
        toast({
            variant: "destructive",
            title,
            description,
            duration: 12000,
        });
    } finally {
        // 3. Clean up the temporary app regardless of success or failure
        await deleteApp(tempApp);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Subcomisión
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Subcomisión</DialogTitle>
          <DialogDescription>
            Registra una nueva subcomisión y su responsable.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Datos de la Subcomisión</h3>
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
            </div>

            <Separator />
            
            <div className="space-y-2">
                 <h3 className="font-semibold text-foreground flex items-center gap-2"><UserPlus className="h-5 w-5" /> Datos del Administrador</h3>
                 <FormField
                    control={form.control}
                    name="adminDisplayName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre y Apellido del Admin</FormLabel>
                        <FormControl>
                            <Input placeholder="Marcelo Gallardo" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="adminEmail"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email del Admin</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="mg@clubnombre.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="adminEmailConfirm"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Confirmar Email del Admin</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="mg@clubnombre.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="adminPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contraseña Inicial</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                         <p className="text-xs text-muted-foreground pt-1">Mínimo 6 caracteres. El administrador podrá cambiarla luego.</p>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando..." : "Crear Subcomisión"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
