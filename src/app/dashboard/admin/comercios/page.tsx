"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useFirebase, useUserProfile } from "@/firebase";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Comercio } from "@/lib/types/comercio";
import { ComercioFormDialog } from "@/components/regatas/ComercioFormDialog";

export default function ComerciosAdminPage() {
  const router = useRouter();
  const { app } = useFirebase();
  const { isSuperAdmin, isReady } = useUserProfile();
  const { toast } = useToast();
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formComercio, setFormComercio] = useState<Comercio | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const fetchComercios = useCallback(async () => {
    if (!app) return;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return;
    const res = await fetch("/api/admin/comercios", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Error al cargar comercios");
    }
    const data = await res.json();
    setComercios(Array.isArray(data) ? data : []);
  }, [app]);

  useEffect(() => {
    if (!isReady) return;
    if (!isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [isReady, isSuperAdmin, router]);

  useEffect(() => {
    if (!isReady || !isSuperAdmin || !app) return;
    setLoading(true);
    fetchComercios()
      .finally(() => setLoading(false))
      .catch((e) => {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      });
  }, [isReady, isSuperAdmin, app, fetchComercios, toast]);

  const handleDelete = async () => {
    if (!deleteId || !app) return;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/comercios/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al borrar");
      }
      setDeleteId(null);
      await fetchComercios();
      toast({ title: "Comercio borrado", description: "El comercio fue eliminado correctamente." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo borrar",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setFormComercio(null);
    fetchComercios();
  };

  const getEstadoBadge = (estado: Comercio["estadoConvenio"]) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      activo: "default",
      pendiente: "secondary",
      vencido: "destructive",
      rescindido: "outline",
    };
    return <Badge variant={map[estado] ?? "outline"}>{estado}</Badge>;
  };

  const beneficioLabel = (c: Comercio) =>
    c.porcentajeDescuento ? `${c.porcentajeDescuento}% OFF` : c.tipoBeneficio || "—";

  if (!isReady || !isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold uppercase text-crsn-text-dark">
            Regatas+ — Comercios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestioná los comercios adheridos al programa de beneficios.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormComercio(null);
            setFormOpen(true);
          }}
          className="bg-crsn-orange hover:bg-crsn-orange-hover"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo comercio
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Listado de comercios
          </CardTitle>
          <CardDescription>
            {comercios.length} comercio{comercios.length !== 1 ? "s" : ""} en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : comercios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay comercios cargados. Agregá el primero con el botón de arriba.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comercio</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Beneficio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comercios.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <a
                        href={`/regatas-plus/comercios/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-crsn-orange hover:underline inline-flex items-center gap-1"
                      >
                        {c.razonSocial}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>{c.rubro}</TableCell>
                    <TableCell>{beneficioLabel(c)}</TableCell>
                    <TableCell>{getEstadoBadge(c.estadoConvenio)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFormComercio(c);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ComercioFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        comercio={formComercio}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este comercio?</AlertDialogTitle>
            <AlertDialogDescription>
              La acción no se puede deshacer. El comercio desaparecerá del listado público de Regatas+.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
