"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Search,
  Loader2,
  Download,
  Users,
  Filter,
  Upload,
} from "lucide-react";
import { useFirestore } from "@/firebase";
import { collectionGroup, getDocs, query, limit, collection, doc, writeBatch, Timestamp } from "firebase/firestore";
import type { Subcomision, Socio } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type SocioWithSubcomision = Socio & { subcomisionId: string };

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvValue(c: string | number | Date | undefined | { toDate?: () => Date }): string {
  if (c == null) return "";
  if (c instanceof Date) return format(c, "yyyy-MM-dd", { locale: es });
  if (typeof c === "object" && typeof (c as { toDate?: () => Date }).toDate === "function")
    return format((c as { toDate: () => Date }).toDate(), "yyyy-MM-dd", { locale: es });
  return escapeCsvCell(c);
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | Date | undefined | { toDate?: () => Date })[][]
) {
  const line = (row: (string | number | Date | undefined | { toDate?: () => Date })[]) =>
    row.map(toCsvValue).join(",");
  const csv = [headers.join(","), ...rows.map(line)].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SuperAdminSociosTabProps = {
  subcomisiones: Subcomision[] | null;
  subcomisionesLoading: boolean;
};

/** Nombres de columnas comunes que pueden venir en un Excel exportado de otro programa */
const EXCEL_COLUMN_ALIASES: Record<string, string[]> = {
  nombre: ["nombre", "Nombre", "NOMBRE", "nombre_socio", "Nombres"],
  apellido: ["apellido", "Apellido", "APELLIDO", "apellidos", "Apellidos"],
  email: ["email", "Email", "EMAIL", "mail", "correo", "Correo"],
  dni: ["dni", "DNI", "documento", "Documento", "cedula"],
  telefono: ["telefono", "Telefono", "teléfono", "celular", "Celular", "phone"],
  numeroSocio: ["numero_socio", "numeroSocio", "Número Socio", "numero", "Nro Socio"],
  fechaAlta: ["fecha_alta", "Fecha Alta", "fechaAlta", "alta"],
  fechaNacimiento: ["fecha_nacimiento", "fechaNacimiento", "nacimiento", "nacimiento_fecha"],
};

function findColumnValue(row: Record<string, unknown>, field: keyof typeof EXCEL_COLUMN_ALIASES): string {
  const aliases = EXCEL_COLUMN_ALIASES[field];
  for (const alias of aliases) {
    const val = row[alias];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return "";
}

export function SuperAdminSociosTab({
  subcomisiones,
  subcomisionesLoading,
}: SuperAdminSociosTabProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allSocios, setAllSocios] = useState<SocioWithSubcomision[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubcomisionId, setFilterSubcomisionId] = useState<string>("all");
  const [filterArchived, setFilterArchived] = useState<"all" | "active" | "archived">("active");

  const [importing, setImporting] = useState(false);
  const [importTargetSubcomisionId, setImportTargetSubcomisionId] = useState<string>("");

  const loadSocios = useCallback(async () => {
    if (!firestore) return;
    setLoading(true);
    try {
      const [sociosSnap, playersSnap] = await Promise.all([
        getDocs(query(collectionGroup(firestore, "socios"), limit(10000))),
        getDocs(query(collectionGroup(firestore, "players"), limit(10000))),
      ]);
      const list: SocioWithSubcomision[] = [];
      const addFromSnapshot = (snap: typeof sociosSnap) => {
        snap.docs.forEach((d) => {
          const pathParts = d.ref.path.split("/");
          const subcomisionId = pathParts[1];
          const data = d.data();
          const nombre = data.nombre ?? data.firstName ?? "";
          const apellido = data.apellido ?? data.lastName ?? "";
          const createdAt = data.createdAt?.toDate?.() ?? data.fechaAlta ?? new Date();
          list.push({
            id: d.id,
            subcomisionId,
            nombre,
            apellido,
            firstName: nombre,
            lastName: apellido,
            email: data.email ?? "",
            dni: data.dni ?? "",
            telefono: data.telefono ?? "",
            fechaNacimiento: data.fechaNacimiento ?? "",
            fechaAlta: data.fechaAlta ?? "",
            numeroSocio: data.numeroSocio ?? "",
            tipoSocio: (data.tipoSocio ?? "general") as Socio["tipoSocio"],
            esFederado: data.esFederado ?? false,
            esVitalicio: data.esVitalicio ?? false,
            estaActivo: data.estaActivo ?? true,
            subcomisiones: data.subcomisiones ?? [subcomisionId],
            status: data.status ?? "active",
            archived: data.archived ?? false,
            createdAt,
            ...data,
          } as SocioWithSubcomision);
        });
      };
      addFromSnapshot(sociosSnap);
      addFromSnapshot(playersSnap);
      const seen = new Set<string>();
      const merged = list.filter((s) => {
        const key = `${s.subcomisionId}:${s.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setAllSocios(merged);
    } catch (e) {
      console.error("[SuperAdminSociosTab] Error loading socios:", e);
      setAllSocios([]);
    } finally {
      setLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    loadSocios();
  }, [loadSocios]);

  const subcomisionNames = useMemo(() => {
    const m = new Map<string, string>();
    (subcomisiones ?? []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [subcomisiones]);

  const filteredSocios = useMemo(() => {
    let result = allSocios;
    if (filterSubcomisionId && filterSubcomisionId !== "all") {
      result = result.filter((s) => s.subcomisionId === filterSubcomisionId);
    }
    if (filterArchived === "active") {
      result = result.filter((s) => !s.archived);
    } else if (filterArchived === "archived") {
      result = result.filter((s) => s.archived);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          (s.nombre ?? s.firstName ?? "").toLowerCase().includes(q) ||
          (s.apellido ?? s.lastName ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          (s.dni ?? "").toLowerCase().includes(q) ||
          (s.numeroSocio ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSocios, filterSubcomisionId, filterArchived, searchQuery]);

  const handleExport = () => {
    if (!subcomisiones?.length || !filteredSocios.length) return;
    const schoolNames = new Map(subcomisiones.map((s) => [s.id, s.name]));
    downloadCsv(
      `socios-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Subcomisión", "Nombre", "Apellido", "Email", "DNI", "Teléfono", "Nº Socio", "Estado", "Archivado", "Fecha alta"],
      filteredSocios.map((s) => [
        schoolNames.get(s.subcomisionId) ?? s.subcomisionId,
        s.nombre ?? s.firstName ?? "",
        s.apellido ?? s.lastName ?? "",
        s.email ?? "",
        s.dni ?? "",
        s.telefono ?? "",
        s.numeroSocio ?? "",
        s.status ?? "active",
        s.archived ? "Sí" : "No",
        s.fechaAlta ?? s.createdAt ?? "",
      ])
    );
    toast({ title: "Exportado", description: "Se descargó el CSV correctamente." });
  };

  const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importTargetSubcomisionId || !firestore) return;
    e.target.value = "";
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
      if (!rows.length) {
        toast({ variant: "destructive", title: "Archivo vacío", description: "El Excel no tiene filas de datos." });
        return;
      }
      const sociosRef = collection(firestore, `subcomisiones/${importTargetSubcomisionId}/socios`);
      const BATCH_SIZE = 500;
      let created = 0;
      const toCreate: Array<{ nombre: string; apellido: string; email: string; dni: string; telefono: string; numeroSocio: string; fechaAlta: string; fechaNacimiento: string }> = [];
      for (const row of rows) {
        const nombre = findColumnValue(row, "nombre") || findColumnValue(row, "apellido");
        const apellido = findColumnValue(row, "apellido") || findColumnValue(row, "nombre");
        if (!nombre && !apellido) continue;
        toCreate.push({
          nombre: nombre || "—",
          apellido: apellido || "—",
          email: findColumnValue(row, "email"),
          dni: findColumnValue(row, "dni"),
          telefono: findColumnValue(row, "telefono"),
          numeroSocio: findColumnValue(row, "numeroSocio"),
          fechaAlta: findColumnValue(row, "fechaAlta") || format(new Date(), "yyyy-MM-dd"),
          fechaNacimiento: findColumnValue(row, "fechaNacimiento"),
        });
      }
      for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = toCreate.slice(i, i + BATCH_SIZE);
        for (const item of chunk) {
          const newRef = doc(sociosRef);
          batch.set(newRef, {
            nombre: item.nombre,
            apellido: item.apellido,
            email: item.email || "",
            dni: item.dni || "",
            telefono: item.telefono || "",
            numeroSocio: item.numeroSocio || "",
            fechaAlta: item.fechaAlta,
            fechaNacimiento: item.fechaNacimiento || "",
            tipoSocio: "general",
            esFederado: false,
            esVitalicio: false,
            estaActivo: true,
            subcomisiones: [importTargetSubcomisionId],
            subcomisionId: importTargetSubcomisionId,
            status: "active",
            archived: false,
            createdAt: Timestamp.now(),
            createdBy: "excel_import",
          });
          created++;
        }
        await batch.commit();
      }
      toast({
        title: "Importación completada",
        description: `Se importaron ${created} socios correctamente.`,
      });
      await loadSocios();
    } catch (err) {
      console.error("[SuperAdminSociosTab] Import error:", err);
      toast({
        variant: "destructive",
        title: "Error al importar",
        description: err instanceof Error ? err.message : "No se pudo procesar el archivo.",
      });
    } finally {
      setImporting(false);
    }
  };

  const isLoading = loading || subcomisionesLoading;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Lista completa de socios
          </CardTitle>
          <CardDescription>
            Vista global de todos los socios del club. Podés filtrar y exportar. También podés cargar socios desde un Excel exportado de otro programa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, apellido, email, DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterSubcomisionId} onValueChange={setFilterSubcomisionId}>
              <SelectTrigger className="w-[220px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Todas las subcomisiones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las subcomisiones</SelectItem>
                {(subcomisiones ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterArchived} onValueChange={(v) => setFilterArchived(v as typeof filterArchived)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Solo activos</SelectItem>
                <SelectItem value="archived">Solo archivados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredSocios.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Importar Excel */}
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border bg-muted/30">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Cargar socios desde Excel:</span>
            <Select
              value={importTargetSubcomisionId}
              onValueChange={setImportTargetSubcomisionId}
              disabled={importing}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Elegir subcomisión destino" />
              </SelectTrigger>
              <SelectContent>
                {(subcomisiones ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelSelect}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!importTargetSubcomisionId || importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing ? "Importando..." : "Seleccionar archivo"}
            </Button>
            <span className="text-xs text-muted-foreground">
              El Excel puede tener columnas: nombre, apellido, email, dni, telefono, numero_socio, fecha_alta
            </span>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subcomisión</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Apellido</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Nº Socio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredSocios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No hay socios que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  filteredSocios.map((s) => (
                    <TableRow
                      key={`${s.subcomisionId}-${s.id}`}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => router.push(`/dashboard/players/${s.id}?subcomisionId=${s.subcomisionId}`)}
                    >
                      <TableCell className="font-medium">
                        {subcomisionNames.get(s.subcomisionId) ?? s.subcomisionId}
                      </TableCell>
                      <TableCell>{s.nombre ?? s.firstName ?? "—"}</TableCell>
                      <TableCell>{s.apellido ?? s.lastName ?? "—"}</TableCell>
                      <TableCell>{s.email || "—"}</TableCell>
                      <TableCell>{s.dni || "—"}</TableCell>
                      <TableCell>{s.telefono || "—"}</TableCell>
                      <TableCell>{s.numeroSocio || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            s.archived ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {s.archived ? "Archivado" : (s.status ?? "active") === "active" ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/players/${s.id}?subcomisionId=${s.subcomisionId}`);
                          }}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {!isLoading && filteredSocios.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredSocios.length} de {allSocios.length} socios
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
