"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  Building,
  Users,
  UserCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useUserProfile } from "@/firebase";
import type { Subcomision, PlatformUser, Socio } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Jugador con subcomisionId extraído del path (collection group). */
type PlayerWithSchoolId = Socio & { schoolId: string };

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

type SuperAdminReportsTabProps = {
  subcomisiones?: Subcomision[] | null;
  schools?: Subcomision[] | null;
  platformUsers: PlatformUser[] | null;
  schoolsLoading: boolean;
  usersLoading: boolean;
};

export function SuperAdminReportsTab({
  subcomisiones: subcomisionesProp,
  schools,
  platformUsers,
  schoolsLoading,
  usersLoading,
}: SuperAdminReportsTabProps) {
  const subcomisiones = subcomisionesProp ?? schools ?? null;
  const router = useRouter();
  const { user, isSuperAdmin } = useUserProfile();
  const [allPlayers, setAllPlayers] = useState<PlayerWithSchoolId[]>([]);
  const [sociosLoading, setPlayersLoading] = useState(true);

  useEffect(() => {
    if (!user || !isSuperAdmin) {
      setAllPlayers([]);
      setPlayersLoading(false);
      return;
    }
    let cancelled = false;
    setPlayersLoading(true);
    const run = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/socios-aggregate", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled || !res.ok) throw new Error("aggregate failed");
        const json = (await res.json()) as { items: Record<string, unknown>[] };
        if (cancelled) return;
        const list: PlayerWithSchoolId[] = json.items.map((item) => {
          const createdAt = item.createdAt ? new Date(String(item.createdAt)) : new Date();
          const birthRaw = item.birthDate;
          const birthDate =
            birthRaw != null && String(birthRaw)
              ? new Date(String(birthRaw))
              : new Date();
          return {
            id: String(item.id),
            schoolId: String(item.subcomisionId),
            nombre: String(item.nombre ?? ""),
            apellido: String(item.apellido ?? ""),
            firstName: String(item.firstName ?? item.nombre ?? ""),
            lastName: String(item.lastName ?? item.apellido ?? ""),
            email: String(item.email ?? ""),
            dni: String(item.dni ?? ""),
            telefono: item.telefono != null ? String(item.telefono) : undefined,
            fechaNacimiento: item.fechaNacimiento != null ? String(item.fechaNacimiento) : undefined,
            tipoSocio: (item.tipoSocio as Socio["tipoSocio"]) ?? "general",
            esFederado: Boolean(item.esFederado),
            esVitalicio: Boolean(item.esVitalicio),
            estaActivo: Boolean(item.estaActivo),
            subcomisiones: Array.isArray(item.subcomisiones)
              ? (item.subcomisiones as string[])
              : [String(item.subcomisionId)],
            numeroSocio: String(item.numeroSocio ?? ""),
            fechaAlta: item.fechaAlta != null ? String(item.fechaAlta) : "",
            status: (item.status as Socio["status"]) ?? "active",
            birthDate,
            tutorContact: (item.tutorContact as PlayerWithSchoolId["tutorContact"]) ?? { name: "", phone: "" },
            createdAt,
            createdBy: String(item.createdBy ?? ""),
            archived: Boolean(item.archived),
          } as PlayerWithSchoolId;
        });
        setAllPlayers(list);
      } catch {
        if (!cancelled) setAllPlayers([]);
      } finally {
        if (!cancelled) setPlayersLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, isSuperAdmin]);

  const playersBySchool = useMemo(() => {
    const map = new Map<string, { count: number; active: number }>();
    (subcomisiones ?? []).forEach((s) => map.set(s.id, { count: 0, active: 0 }));
    allPlayers.forEach((p) => {
      if (p.archived) return;
      const cur = map.get(p.schoolId) ?? { count: 0, active: 0 };
      cur.count += 1;
      if (p.status === "active") cur.active += 1;
      map.set(p.schoolId, cur);
    });
    return map;
  }, [subcomisiones, allPlayers]);

  const totalPlayers = useMemo(
    () => allPlayers.filter((p) => !p.archived).length,
    [allPlayers]
  );

  const isLoading = schoolsLoading || usersLoading || sociosLoading;

  const handleExportSchools = () => {
    if (!subcomisiones?.length) return;
    downloadCsv(
      `subcomisiones-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Nombre", "Ciudad", "Provincia", "Dirección", "Estado", "Fecha creación"],
      subcomisiones.map((s) => [
        s.name,
        s.city,
        s.province,
        s.address ?? "",
        s.status,
        s.createdAt,
      ])
    );
  };

  const handleExportUsers = () => {
    if (!platformUsers?.length) return;
    downloadCsv(
      `usuarios-plataforma-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Email", "Gerente del Club", "Fecha creación"],
      platformUsers.map((u) => [
        u.email,
        u.gerente_club ? "Sí" : "No",
        (u as { createdAt?: Date | { toDate?: () => Date } }).createdAt ?? "",
      ])
    );
  };

  const handleExportPlayers = () => {
    if (!allPlayers.length || !subcomisiones?.length) return;
    const schoolNames = new Map(subcomisiones.map((s: Subcomision) => [s.id, s.name]));
    downloadCsv(
      `jugadores-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Subcomisión", "Nombre", "Apellido", "Estado", "Archivado", "Fecha creación"],
      allPlayers.map((p) => [
        schoolNames.get(p.schoolId) ?? p.schoolId,
        p.firstName,
        p.lastName,
        p.status,
        p.archived ? "Sí" : "No",
        p.createdAt,
      ])
    );
  };

  const handleQuickAccess = (schoolId: string) => {
    if (!schoolId) return;
    router.push(`/dashboard/schools/${schoolId}`);
  };

  const schoolList = subcomisiones ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Métricas globales
          </CardTitle>
          <CardDescription>
            Totales y distribución de jugadores por subcomisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total jugadores</CardTitle>
                <UserCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {sociosLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{totalPlayers}</div>
                )}
                <div className="text-xs text-muted-foreground">Sin contar archivados</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Subcomisiones</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {schoolsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{schoolList.length}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {schoolList.filter((s) => s.status === "active").length} activas
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios plataforma</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{platformUsers?.length ?? 0}</div>
                )}
                <div className="text-xs text-muted-foreground">Registrados</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ir a subcomisión</CardTitle>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Select onValueChange={handleQuickAccess}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar subcomisión..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Jugadores por subcomisión</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subcomisión</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Activos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    schoolList.map((s) => {
                      const stats = playersBySchool.get(s.id) ?? { count: 0, active: 0 };
                      return (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => router.push(`/dashboard/schools/${s.id}`)}
                        >
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right">{stats.count}</TableCell>
                          <TableCell className="text-right">{stats.active}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5" />
            Exportar datos
          </CardTitle>
          <CardDescription>
            Descargar listados en CSV para reportes o auditoría.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSchools}
            disabled={!subcomisiones?.length}
          >
            Exportar subcomisiones
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportUsers}
            disabled={!platformUsers?.length}
          >
            Exportar usuarios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPlayers}
            disabled={!allPlayers.length}
          >
            Exportar jugadores
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
