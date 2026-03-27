"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { Building, MoreHorizontal, Power, PowerOff, Loader2, Users, ShieldCheck, Edit, BarChart3, UserCheck } from "lucide-react";
import { useFirestore, useUserProfile } from "@/firebase";
import { useSubcomisionesList } from "@/hooks/use-subcomisiones-list";
import { writeAuditLog } from "@/lib/audit";
import type { Subcomision, PlatformUser } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { Badge } from "../ui/badge";
import { CreateSubcomisionDialog } from "./CreateSchoolDialog";
import { useToast } from "@/hooks/use-toast";
import { EditSubcomisionDialog } from "./EditSchoolDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformUsersList } from "./PlatformUsersList";
import { SuperAdminReportsTab } from "./SuperAdminReportsTab";
import { SuperAdminSociosTab } from "./SuperAdminSociosTab";

const VALID_TABS = ["schools", "socios", "users", "reports"] as const;
const TAB_FROM_URL: Record<string, (typeof VALID_TABS)[number]> = {
  subcomisiones: "schools",
  socios: "socios",
  usuarios: "users",
  users: "users",
  reportes: "reports",
  reports: "reports",
};

export function SuperAdminDashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabFromUrl = searchParams.get("tab");
    const activeTab = TAB_FROM_URL[tabFromUrl ?? ""] ?? "schools";
    const { data: subcomisiones, loading: schoolsLoading, refetch: refetchSubcomisiones } = useSubcomisionesList();
    const schools = subcomisiones;
    const firestore = useFirestore();
    const [platformUsers, setPlatformUsers] = useState<PlatformUser[] | null>(null);
    const [usersLoading, setUsersLoading] = useState(true);
    const [adminsBySubcomision, setAdminsBySubcomision] = useState<Map<string, { displayName: string; email: string }>>(new Map());

    const { user, isSuperAdmin } = useUserProfile();

    useEffect(() => {
        if (!user || !isSuperAdmin) {
            setPlatformUsers(null);
            setUsersLoading(false);
            setAdminsBySubcomision(new Map());
            return;
        }
        let cancelled = false;
        const run = async () => {
            setUsersLoading(true);
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };
                const [puRes, adRes] = await Promise.all([
                    fetch("/api/admin/platform-users", { headers }),
                    fetch("/api/admin/subcomision-admins", { headers }),
                ]);
                if (cancelled) return;
                if (puRes.ok) {
                    const rows = (await puRes.json()) as Array<{
                        id: string;
                        email: string;
                        gerente_club: boolean;
                        super_admin?: boolean;
                        createdAt: string;
                    }>;
                    setPlatformUsers(
                        rows.map((r) => ({
                            id: r.id,
                            email: r.email,
                            gerente_club: r.gerente_club,
                            super_admin: r.super_admin,
                            createdAt: new Date(r.createdAt),
                        }))
                    );
                } else {
                    setPlatformUsers([]);
                }
                if (adRes.ok) {
                    const obj = (await adRes.json()) as Record<string, { displayName: string; email: string }>;
                    setAdminsBySubcomision(new Map(Object.entries(obj)));
                } else {
                    setAdminsBySubcomision(new Map());
                }
            } catch {
                if (!cancelled) {
                    setPlatformUsers([]);
                    setAdminsBySubcomision(new Map());
                }
            } finally {
                if (!cancelled) setUsersLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [user, isSuperAdmin]);
    const { toast } = useToast();
    const [updatingSchoolId, setUpdatingSchoolId] = useState<string | null>(null);

    const isLoading = schoolsLoading || usersLoading;

    const handleStatusChange = async (subcomisionId: string, currentStatus: 'active' | 'suspended') => {
        setUpdatingSchoolId(subcomisionId);
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/admin/subcomisiones/${encodeURIComponent(subcomisionId)}/status`, {
                method: "PATCH",
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error("status failed");
            await refetchSubcomisiones();
            if (user?.uid && user?.email && firestore) {
              await writeAuditLog(firestore, user.email, user.uid, {
                action: "school.status_change",
                resourceType: "school",
                resourceId: subcomisionId,
                subcomisionId,
                details: newStatus,
              });
            }
            toast({
                title: "Estado actualizado",
                description: `La subcomisión ha sido ${newStatus === 'active' ? 'activada' : 'suspendida'}.`,
            });
        } catch {
            toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo cambiar el estado de la subcomisión.",
            });
        } finally {
            setUpdatingSchoolId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Panel de Gerente del Club</h1>
                    <p className="text-muted-foreground">Gestiona las subcomisiones y sus responsables.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <CreateSubcomisionDialog />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Subcomisiones</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{schools?.length || 0}</div>}
                        <div className="text-xs text-muted-foreground">
                            {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `${schools?.filter(s => s.status === 'active').length || 0} activas`}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Registrados</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{platformUsers?.length || 0}</div>}
                        <div className="text-xs text-muted-foreground">
                             {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `En toda la plataforma`}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{platformUsers?.filter(u => u.gerente_club).length || 0}</div>}
                         <div className="text-xs text-muted-foreground">
                            {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `Con acceso total al sistema`}
                        </div>
                    </CardContent>
                </Card>
            </div>

             <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  const tabParam = v === "schools" ? "subcomisiones" : v;
                  router.push(`/dashboard?tab=${tabParam}`);
                }}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-4 gap-1 p-1 h-auto md:h-10 bg-card">
                    <TabsTrigger value="schools" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <Building className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Subcomisiones</span>
                    </TabsTrigger>
                    <TabsTrigger value="socios" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <UserCheck className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Socios</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <Users className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Usuarios</span>
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Reportes</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="schools">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Building className="h-5 w-5" />
                                Listado de Subcomisiones
                            </CardTitle>
                            <CardDescription>
                                {schoolsLoading ? 'Cargando listado...' : `Haz click en una para gestionarla.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-b-lg sm:rounded-none border-t sm:border-t-0">
                                <Table className="min-w-[560px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs sm:text-sm">Nombre</TableHead>
                                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Responsable</TableHead>
                                            <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha de Creación</TableHead>
                                            <TableHead className="text-right w-[80px]">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                <TableBody>
                                    {schoolsLoading && [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-36" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))}
                                    {schools?.map((school) => (
                                        <TableRow key={school.id} className="cursor-pointer hover:bg-muted" onClick={() => router.push(`/dashboard/schools/${school.id}`)}>
                                            <TableCell className="font-medium">
                                                {school.name}
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const admin = adminsBySubcomision.get(school.id);
                                                    return admin ? (
                                                        <span className="block">
                                                            <span className="font-medium">{admin.displayName}</span>
                                                            <span className="text-muted-foreground text-xs block">{admin.email}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">—</span>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={school.status === 'active' ? 'secondary' : 'destructive'}
                                                    className={`capitalize ${school.status === "active" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""}`}
                                                >
                                                    {school.status === 'active' ? 'Activa' : 'Suspendida'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{format(school.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                                            <TableCell className="text-right">
                                            <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} disabled={updatingSchoolId === school.id}>
                                                            <span className="sr-only">Abrir menú</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <EditSubcomisionDialog school={school}>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                <span>Editar Datos</span>
                                                            </DropdownMenuItem>
                                                        </EditSubcomisionDialog>
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                handleStatusChange(school.id, school.status);
                                                            }}
                                                            disabled={updatingSchoolId === school.id}
                                                        >
                                                            {updatingSchoolId === school.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : school.status === 'active' ? (
                                                                <PowerOff className="mr-2 h-4 w-4" />
                                                            ) : (
                                                                <Power className="mr-2 h-4 w-4" />
                                                            )}
                                                            <span>{updatingSchoolId === school.id ? 'Actualizando...' : school.status === 'active' ? 'Suspender' : 'Activar'}</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            {(!schoolsLoading && !schools?.length) && (
                                <p className="text-center text-muted-foreground py-8">No hay subcomisiones para mostrar.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="socios">
                    <SuperAdminSociosTab
                        subcomisiones={schools ?? null}
                        subcomisionesLoading={schoolsLoading}
                    />
                </TabsContent>
                <TabsContent value="reports">
                    <SuperAdminReportsTab
                        subcomisiones={schools ?? null}
                        platformUsers={platformUsers ?? null}
                        schoolsLoading={schoolsLoading}
                        usersLoading={usersLoading}
                    />
                </TabsContent>
                <TabsContent value="users">
                   <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Gestión de Usuarios Globales
                            </CardTitle>
                            <CardDescription>
                                {usersLoading ? 'Cargando usuarios...' : 'Gestiona los roles de todos los usuarios de la plataforma.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-b-lg sm:rounded-none border-t sm:border-t-0">
                                <PlatformUsersList subcomisiones={schools ?? []} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
