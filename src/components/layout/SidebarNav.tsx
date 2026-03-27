"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Home,
  Users,
  Settings,
  Building,
  Shield,
  UserCheck,
  Video,
  ClipboardCheck,
  Activity,
  Mail,
  MessageCircle,
  Headphones,
  Banknote,
  FileText,
  FileHeart,
  Sliders,
  Newspaper,
  Dumbbell,
  Plane,
  Store,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { EscudoCRSN } from "../icons/EscudoCRSN";
import { useUserProfile, useCollection, useDoc, useFirebase } from "@/firebase";
import { isPlayerProfileComplete } from "@/lib/utils";
import type { Socio, Subcomision, SubcomisionModuleKey } from "@/lib/types";
import { isSubcomisionModuleEnabled } from "@/lib/subcomision-modules";
import { isMedicalRecordApproved } from "@/lib/utils";
import { getAuth } from "firebase/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleKey?: SubcomisionModuleKey;
  badgeOverdue?: boolean;
};

// Orden por importancia: núcleo operativo → seguimiento → comunicación → administración
/** Menú para admin_subcomision: sin Evaluaciones Físicas, Asistencia ni Videoteca (solo para profesores). */
const schoolUserMenuItemsAdmin: NavItem[] = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
  { href: "/dashboard/training-schedules", label: "Entrenamientos", icon: Dumbbell, moduleKey: "trainingSchedules" },
  { href: "/dashboard/medical-records", label: "Fichas médicas", icon: FileHeart, moduleKey: "medicalRecords" },
  { href: "/dashboard/registrations", label: "Solicitudes", icon: UserCheck, moduleKey: "registrations" },
  { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle, moduleKey: "support" },
  { href: "/dashboard/notas", label: "Notas", icon: Newspaper, moduleKey: "notas" },
];

/** Menú para profesores: solo Evaluaciones Físicas además de lo básico. Sin Asistencia, Entrenamientos, Videoteca ni Centro de Soporte. */
const schoolUserMenuItemsProfesor: NavItem[] = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
  { href: "/dashboard/medical-records", label: "Fichas médicas", icon: FileHeart, moduleKey: "medicalRecords" },
  { href: "/dashboard/registrations", label: "Solicitudes", icon: UserCheck, moduleKey: "registrations" },
  { href: "/dashboard/physical-assessments-config", label: "Evaluaciones Físicas", icon: Activity, moduleKey: "physicalEvaluations" },
  { href: "/dashboard/notas", label: "Notas", icon: Newspaper, moduleKey: "notas" },
];

/** Rutas bajo el hub «Configuración global» (solo enlaces desde esa página). */
const SUPER_ADMIN_CONFIG_HUB_PATHS = new Set([
  "/dashboard/admin/config",
  "/dashboard/admin/test-email",
  "/dashboard/admin/audit",
  "/dashboard/admin/delete-test-users",
]);

const superAdminMenuItems: NavItem[] = [
    { href: "/dashboard", label: "Panel del Gerente", icon: Home },
    { href: "/dashboard?tab=subcomisiones", label: "Subcomisiones", icon: Building },
    { href: "/dashboard?tab=socios", label: "Socios", icon: UserCheck },
    { href: "/dashboard/admin/comercios", label: "Regatas+ Comercios", icon: Store },
    { href: "/dashboard/admin/physical-template", label: "Evaluaciones físicas (plantilla)", icon: Activity },
    { href: "/dashboard/support/operator", label: "Tickets de Soporte", icon: Headphones },
    { href: "/dashboard/admin/config", label: "Configuración global", icon: Sliders },
    { href: "/dashboard/notas", label: "Notas", icon: Newspaper },
];


export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const { app } = useFirebase();
  const { isSuperAdmin, isReady, profile, activeSchoolId, isPlayer } = useUserProfile();
  const [hasPaymentOverdue, setHasPaymentOverdue] = useState(false);
  const playerPath = profile?.role === "player" && profile?.activeSchoolId && profile?.socioId
    ? `subcomisiones/${profile.activeSchoolId}/socios/${profile.playerId ?? profile.socioId}`
    : "";
  const { data: player } = useDoc<Socio>(playerPath);
  const playerProfileComplete = !player || isPlayerProfileComplete(player);

  const fetchPaymentOverdue = useCallback(async () => {
    if (!isPlayer || !app) return;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return;
    const res = await fetch("/api/payments/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setHasPaymentOverdue(Boolean(data.hasOverdue));
  }, [isPlayer, app]);

  useEffect(() => {
    if (isReady && isPlayer) fetchPaymentOverdue();
  }, [isReady, isPlayer, fetchPaymentOverdue]);

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  // Solo staff (admin_subcomision o encargado_deportivo) puede listar pendingSocios; nunca listar si es jugador.
  const isStaff = profile?.role === "admin_subcomision" || profile?.role === "encargado_deportivo";
  const canListSchoolCollections = isReady && activeSchoolId && isStaff;

  const { data: allPlayers } = useCollection<Socio>(
    canListSchoolCollections ? `subcomisiones/${activeSchoolId}/socios` : "",
    {}
  );
  const medicalRecordsPendingCount = React.useMemo(() => {
    if (!allPlayers?.length) return 0;
    return allPlayers.filter(
      (p) => !p.archived && (!p.medicalRecord?.url || !isMedicalRecordApproved(p))
    ).length;
  }, [allPlayers]);

  const schoolIdForModules =
    profile?.role === "player"
      ? (profile.activeSchoolId ?? undefined)
      : (activeSchoolId ?? undefined);
  const modulesDocPath =
    !isSuperAdmin && schoolIdForModules ? `subcomisiones/${schoolIdForModules}` : "";
  const { data: subcomisionForModules } = useDoc<Subcomision>(modulesDocPath);

  let menuItems: NavItem[];

  if (isSuperAdmin) {
    menuItems = superAdminMenuItems;
  } else if (profile?.role === 'player' && profile.activeSchoolId && profile.playerId) {
    // Jugador: si perfil incompleto "Mi perfil" + "Pagos"; si completo, panel, perfil, pagos y soporte
    const profileHref = `/dashboard/players/${profile.playerId}?subcomisionId=${profile.activeSchoolId}`;
    if (!playerProfileComplete) {
      const tab = (t: string) => `${profileHref}&tab=${t}`;
      menuItems = [
        { href: profileHref, label: "Mi perfil", icon: Users },
        { href: tab("attendance"), label: "Asistencia", icon: ClipboardCheck, moduleKey: "attendance" },
        { href: tab("evaluations"), label: "Evaluaciones deportivas", icon: FileText, moduleKey: "evaluations" },
        { href: tab("physical"), label: "Evaluaciones físicas", icon: Activity, moduleKey: "physicalEvaluations" },
        { href: tab("videoteca"), label: "Videoteca", icon: Video, moduleKey: "videoteca" },
        { href: "/dashboard/payments", label: "Mis pagos", icon: Banknote, badgeOverdue: true, moduleKey: "payments" },
      ];
    } else {
      const tab = (t: string) => `${profileHref}&tab=${t}`;
      menuItems = [
        { href: "/dashboard", label: "Panel Principal", icon: Home },
        { href: profileHref, label: "Mi perfil", icon: Users },
        { href: tab("videoteca"), label: "Videoteca", icon: Video, moduleKey: "videoteca" },
        { href: "/dashboard/payments", label: "Mis pagos", icon: Banknote, badgeOverdue: true, moduleKey: "payments" },
        { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle, moduleKey: "support" },
      ];
    }
  } else {
    // Profesores: menú reducido sin Asistencia, Entrenamientos, Evaluaciones Físicas ni Videoteca
    // Admin subcomisión: menú completo + Pagos, Viajes, Mensajes, Gestionar Subcomisión (sin Mensualidades)
    const baseMenu = profile?.role === 'encargado_deportivo'
      ? [...schoolUserMenuItemsProfesor]
      : [...schoolUserMenuItemsAdmin];
    menuItems = baseMenu;
    const canSeeSchoolOps =
      (profile?.role === "admin_subcomision" || profile?.role === "encargado_deportivo") &&
      profile.activeSchoolId;
    if (canSeeSchoolOps) {
      const pagos: NavItem = { href: "/dashboard/payments", label: "Pagos", icon: Banknote, moduleKey: "payments" };
      const viajes: NavItem = {
        href: `/dashboard/subcomisiones/${profile.activeSchoolId}/viajes`,
        label: "Viajes",
        icon: Plane,
        moduleKey: "viajes",
      };
      const entradas: NavItem = {
        href: `/dashboard/subcomisiones/${profile.activeSchoolId}/entradas`,
        label: "Venta de entradas",
        icon: Ticket,
        moduleKey: "ventaEntradas",
      };
      const mensajes: NavItem = { href: "/dashboard/messages", label: "Mensajes", icon: Mail, moduleKey: "messages" };
      const gestionarEscuela: NavItem = {
        href: `/dashboard/subcomisiones/${profile.activeSchoolId}`,
        label: "Gestionar Subcomisión",
        icon: Shield,
      };
      const baseWithoutNotas = menuItems.filter((i) => i.href !== "/dashboard/notas");
      const afterAttendance = 3; // Después de entrenamientos (índice 2); insertar Pagos/Viajes antes de fichas
      menuItems = [
        ...baseWithoutNotas.slice(0, afterAttendance),
        pagos,
        viajes,
        entradas,
        ...baseWithoutNotas.slice(afterAttendance),
        mensajes,
        gestionarEscuela,
        { href: "/dashboard/notas", label: "Notas", icon: Newspaper, moduleKey: "notas" },
      ];
    }
  }

  if (!isSuperAdmin) {
    menuItems = menuItems.filter(
      (item) =>
        !item.moduleKey ||
        isSubcomisionModuleEnabled(subcomisionForModules?.moduleFlags, item.moduleKey)
    );
  }

  // Evitar ítems duplicados por href (claves únicas y menú sin duplicados)
  const uniqueMenuItems = Array.from(
    new Map(menuItems.map((item) => [item.href, item])).values()
  );

  return (
    <>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 p-2" onClick={closeMobileSidebar}>
          <EscudoCRSN size={32} className="shrink-0" />
          <span className="text-xl font-bold font-headline uppercase">
            <span className="text-crsn-navy">REGATAS</span>
            <span className="text-crsn-orange">+</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        {!isReady ? (
            <div className="flex flex-col gap-2 pt-2">
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
            </div>
        ) : (
            <SidebarMenu>
            {uniqueMenuItems.map((item) => (
                <SidebarMenuItem key={`${item.href}-${item.label}`}>
                <Link href={item.href} className="relative flex items-center" onClick={closeMobileSidebar}>
                    <SidebarMenuButton
                    isActive={
                      item.href === "/dashboard/admin/config"
                        ? SUPER_ADMIN_CONFIG_HUB_PATHS.has(pathname)
                        : item.href === "/dashboard/payments"
                        ? pathname === "/dashboard/payments"
                        : item.href === "/dashboard"
                        ? pathname === "/dashboard" && !searchParams.get("tab")
                        : item.href.startsWith("/dashboard?tab=")
                        ? pathname === "/dashboard" && searchParams.get("tab") === new URL(item.href, "http://x").searchParams.get("tab")
                        : pathname === item.href || (item.href !== "/dashboard" && !item.href.startsWith("/dashboard?") && pathname.startsWith(item.href.split("?")[0]))
                    }
                    tooltip={item.label}
                    className="font-headline w-full"
                    >
                    <item.icon />
                    <span>{item.label}</span>
                    {item.href === "/dashboard/medical-records" && medicalRecordsPendingCount > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs" title="Fichas pendientes">
                        {medicalRecordsPendingCount > 99 ? "99+" : medicalRecordsPendingCount}
                      </Badge>
                    )}
                    {"badgeOverdue" in item && item.badgeOverdue && hasPaymentOverdue && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs" title="Cuota vencida">
                        !
                      </Badge>
                    )}
                    </SidebarMenuButton>
                </Link>
                </SidebarMenuItem>
            ))}
            </SidebarMenu>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard/settings" onClick={closeMobileSidebar}>
              <SidebarMenuButton
                isActive={pathname.startsWith("/dashboard/settings")}
                tooltip="Ajustes"
                className="font-headline"
              >
                <Settings />
                <span>Ajustes</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
