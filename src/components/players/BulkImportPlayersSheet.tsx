"use client";

import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserProfile, useCollection } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import { useFirebase } from "@/firebase";
import type { CategoriaViaje } from "@/lib/types/viaje";

export function BulkImportPlayersSheet() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, activeSchoolId } = useUserProfile();
  const { app } = useFirebase();
  const { toast } = useToast();

  const { data: categorias } = useCollection<CategoriaViaje & { orden?: number }>(
    activeSchoolId ? `subcomisiones/${activeSchoolId}/categorias` : "",
    {}
  );
  const listaCategorias = categorias ?? [];

  const canImport =
    profile &&
    activeSchoolId &&
    (profile.role === "admin_subcomision" || profile.role === "encargado_deportivo");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSchoolId || !app) {
      e.target.value = "";
      return;
    }
    e.target.value = "";

    const ext = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv", "pdf"].includes(ext ?? "")) {
      toast({
        variant: "destructive",
        title: "Formato no válido",
        description: "Usá Excel (.xlsx, .xls), CSV o PDF.",
      });
      return;
    }

    setImporting(true);
    try {
      const token = await getAuth(app).currentUser?.getIdToken();
      if (!token) {
        toast({ variant: "destructive", title: "Error", description: "No estás autenticado." });
        return;
      }

      const formData = new FormData();
      formData.set("file", file);
      formData.set("schoolId", activeSchoolId);
      if (categoriaId) formData.set("categoriaId", categoriaId);

      const res = await fetch("/api/players/bulk-import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: data.error ?? "Error al importar",
          description: data.detail ?? data.message,
        });
        return;
      }

      toast({
        title: "Importación exitosa",
        description: data.message ?? `Se importaron ${data.created ?? 0} jugadores.`,
      });
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo completar la importación.",
      });
    } finally {
      setImporting(false);
    }
  };

  if (!canImport) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Cargar masivamente
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-headline">Cargar jugadores masivamente</SheetTitle>
          <SheetDescription>
            Subí un archivo Excel (.xlsx, .xls), CSV o PDF con los datos de los jugadores. Columnas sugeridas:
            nombre, apellido, email, dni, telefono, tutor_nombre, tutor_telefono, fecha_nacimiento (o edad, que se usa para calcularla), obra_social.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-4">
          {listaCategorias.length > 0 && (
            <div className="space-y-2">
              <Label>Categoría para los jugadores importados</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {listaCategorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. Si elegís una categoría, todos los jugadores importados se asignarán a ella (U21, U17, U9, etc.).
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Seleccionar archivo
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            El archivo debe tener al menos las columnas nombre y apellido. Podés descargar una plantilla de ejemplo
            como Excel y completarla con tus datos.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
