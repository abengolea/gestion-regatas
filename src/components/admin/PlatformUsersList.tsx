"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Loader2, Shield, ShieldOff, Building2 } from "lucide-react";
import { useFirestore, useUserProfile } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { PlatformUser, Subcomision, SubcomisionUser } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
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


type UserAction = {
    user: PlatformUser;
    action: 'promote' | 'demote';
}

type UserRoleInfo = {
    role: 'admin_subcomision' | 'encargado_deportivo' | 'editor' | 'viewer' | 'player';
    displayName?: string;
    subcomisionId: string;
    socioId?: string;
};

function isUserRoleInfoRole(r: string): r is UserRoleInfo["role"] {
    return ["admin_subcomision", "encargado_deportivo", "editor", "viewer", "player"].includes(r);
}

type PlatformUsersListProps = {
    subcomisiones?: Subcomision[] | null;
};

export function PlatformUsersList({ subcomisiones = [] }: PlatformUsersListProps) {
    const { user: currentUser, isSuperAdmin } = useUserProfile();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [platformUsers, setPlatformUsers] = useState<PlatformUser[] | null>(null);
    const [usersLoading, setUsersLoading] = useState(true);

    const [actionToConfirm, setActionToConfirm] = useState<UserAction | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");

    const [schoolUsers, setSchoolUsers] = useState<(SubcomisionUser & { id: string })[] | null>(null);

    const [allRolesMap, setAllRolesMap] = useState<Map<string, UserRoleInfo>>(new Map());

    useEffect(() => {
        if (!currentUser || !isSuperAdmin) {
            setPlatformUsers(null);
            setUsersLoading(false);
            return;
        }
        let cancelled = false;
        const run = async () => {
            setUsersLoading(true);
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch("/api/admin/platform-users", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (cancelled) return;
                if (!res.ok) {
                    setPlatformUsers([]);
                    return;
                }
                const rows = (await res.json()) as Array<{
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
            } catch {
                if (!cancelled) setPlatformUsers([]);
            } finally {
                if (!cancelled) setUsersLoading(false);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [currentUser, isSuperAdmin]);

    useEffect(() => {
        if (!currentUser || !isSuperAdmin || selectedSchoolId === "all") {
            setSchoolUsers(null);
            return;
        }
        let cancelled = false;
        const run = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `/api/admin/subcomision-users?subcomisionId=${encodeURIComponent(selectedSchoolId)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (cancelled) return;
                if (!res.ok) {
                    setSchoolUsers([]);
                    return;
                }
                const rows = (await res.json()) as (SubcomisionUser & { id: string })[];
                setSchoolUsers(rows);
            } catch {
                if (!cancelled) setSchoolUsers([]);
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [currentUser, isSuperAdmin, selectedSchoolId]);

    useEffect(() => {
        if (selectedSchoolId !== "all") {
            return;
        }
        if (!currentUser || !isSuperAdmin) {
            setAllRolesMap(new Map());
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch("/api/admin/staff-directory", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (cancelled || !res.ok) throw new Error("staff-directory");
                const json = (await res.json()) as {
                    rolesByUserId: Record<
                        string,
                        { role: string; displayName?: string; subcomisionId: string; socioId?: string }
                    >;
                };
                const rolesMap = new Map<string, UserRoleInfo>();
                for (const [uidrow, row] of Object.entries(json.rolesByUserId)) {
                    if (!isUserRoleInfoRole(row.role)) continue;
                    rolesMap.set(uidrow, {
                        role: row.role,
                        displayName: row.displayName,
                        subcomisionId: row.subcomisionId,
                        socioId: row.socioId,
                    });
                }
                setAllRolesMap(rolesMap);
            } catch {
                if (!cancelled) {
                    setAllRolesMap(new Map());
                }
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [selectedSchoolId, currentUser, isSuperAdmin]);

    const roleMap = useMemo(() => {
        if (selectedSchoolId === "all") return allRolesMap;
        const m = new Map<string, UserRoleInfo>();
        schoolUsers?.forEach((u) => {
            if (!isUserRoleInfoRole(u.role)) return;
            m.set(u.id, {
                role: u.role,
                displayName: u.displayName,
                subcomisionId: selectedSchoolId,
            });
        });
        return m;
    }, [selectedSchoolId, schoolUsers, allRolesMap]);

    const filteredUsers = useMemo(() => {
        if (!platformUsers) return [];
        if (selectedSchoolId === "all") return platformUsers;
        if (!schoolUsers) return [];
        const schoolUserIds = new Set(schoolUsers.map((u) => u.id));
        return platformUsers.filter(
            (u) => schoolUserIds.has(u.id) || u.gerente_club
        );
    }, [platformUsers, selectedSchoolId, schoolUsers]);

    const handleUpdateRole = async () => {
        if (!actionToConfirm) return;
        setIsUpdating(true);
        const { user, action } = actionToConfirm;
        const newStatus = action === 'promote';
        const userRef = doc(firestore, 'platformUsers', user.id);

        try {
            await updateDoc(userRef, { super_admin: newStatus });
            if (currentUser?.uid && currentUser?.email) {
              await writeAuditLog(firestore, currentUser.email, currentUser.uid, {
                action: newStatus ? "platform_user.promote_super_admin" : "platform_user.demote_super_admin",
                resourceType: "platformUser",
                resourceId: user.id,
                details: user.email,
              });
            }
            toast({
                title: "Rol actualizado",
                description: `${user.email} ha sido ${newStatus ? 'promovido a' : 'revocado como'} Gerente del Club.`,
            });
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo cambiar el rol del usuario.",
            });
        } finally {
            setIsUpdating(false);
            setActionToConfirm(null);
        }
    };

    const isLoading = usersLoading;

    return (
        <>
        <div className="flex flex-col gap-4 pb-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                    <SelectTrigger className="w-full max-w-[280px] min-w-0">
                        <SelectValue placeholder="Filtrar por escuela" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las escuelas</SelectItem>
                        {subcomisiones?.map((school: Subcomision) => (
                            <SelectItem key={school.id} value={school.id}>
                                {school.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <Table className="min-w-[480px]">
            <TableHeader>
                <TableRow>
                    <TableHead className="text-xs sm:text-sm">Nombre / Email</TableHead>
                    <TableHead className="text-xs sm:text-sm">Rol</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha de Registro</TableHead>
                    <TableHead className="text-right w-[80px]">Acciones</TableHead>
                </TableRow>
            </TableHeader>
                <TableBody>
                    {isLoading && [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                    {filteredUsers?.map((user) => {
                        const info = roleMap.get(user.id);
                        const href = info
                          ? info.socioId
                            ? `/dashboard/players/${info.socioId}?subcomisionId=${info.subcomisionId}`
                            : `/dashboard/schools/${info.subcomisionId}`
                          : null;
                        const displayName = info?.displayName ?? user.email;
                        const roleLabel =
                          info?.role === "admin_subcomision"
                            ? "Admin"
                            : info?.role === "encargado_deportivo"
                              ? "Entrenador"
                              : info?.role === "player"
                                ? "Jugador"
                                : "Usuario";
                        return (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">
                                {href ? (
                                    <Link
                                        href={href}
                                        className="text-primary hover:underline focus:underline"
                                    >
                                        {displayName}
                                    </Link>
                                ) : (
                                    <span>{displayName}</span>
                                )}
                                {displayName !== user.email && (
                                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {user.super_admin ? (
                                    <Badge variant="default" className="bg-primary/80 hover:bg-primary">
                                        <Shield className="mr-2 h-3 w-3" />
                                        Super Admin
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">{roleLabel}</Badge>
                                )}
                            </TableCell>
                            <TableCell>{format(user.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating || user.id === currentUser?.uid}>
                                            <span className="sr-only">Abrir menú</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones de Rol</DropdownMenuLabel>
                                        {user.super_admin ? (
                                            <DropdownMenuItem
                                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                onSelect={() => setActionToConfirm({ user, action: 'demote' })}
                                            >
                                                <ShieldOff className="mr-2 h-4 w-4" />
                                                Revocar Super Admin
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onSelect={() => setActionToConfirm({ user, action: 'promote' })}>
                                                <Shield className="mr-2 h-4 w-4" />
                                                Promover a Super Admin
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
            </Table>
            {(!isLoading && !filteredUsers?.length) && (
                <p className="text-center text-muted-foreground py-8">
                    {selectedSchoolId === "all" ? "No hay usuarios en la plataforma." : "No hay usuarios asignados a esta escuela."}
                </p>
            )}

            <AlertDialog open={!!actionToConfirm} onOpenChange={(open) => !open && setActionToConfirm(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {actionToConfirm?.action === 'promote'
                        ? `Vas a promover a ${actionToConfirm?.user.email} a Super Administrador. Tendrá acceso completo a toda la plataforma.`
                        : `Vas a revocar los privilegios de Super Administrador de ${actionToConfirm?.user.email}. Perderá el acceso completo a la plataforma.`
                      }
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleUpdateRole}
                      disabled={isUpdating}
                      className={actionToConfirm?.action === 'demote' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
                    >
                      {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (actionToConfirm?.action === 'promote' ? <Shield className="mr-2 h-4 w-4" /> : <ShieldOff className="mr-2 h-4 w-4" />)}
                      {isUpdating ? "Actualizando..." : (actionToConfirm?.action === 'promote' ? "Sí, promover" : "Sí, revocar")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
