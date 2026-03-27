"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { getAuth } from "firebase/auth";
import { deleteField, doc, Timestamp, writeBatch } from "firebase/firestore";
import { useDoc, useUserProfile, useFirebase, useCollection, useFirestore } from "@/firebase";
import type { Subcomision, Socio } from "@/lib/types";
import type { PlateaSeatStatus } from "@/lib/types/entradas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Ticket, Loader2, Globe, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SubcomisionModuleGuard } from "@/components/subcomision/SubcomisionModuleGuard";
import { getBasquetPlateasDemoLayout } from "@/lib/entradas/basquet-plateas-layout";
import { BasquetPlateasMap } from "@/components/entradas/BasquetPlateasMap";
import type { PlateaSeatView } from "@/components/entradas/BasquetPlateasMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VentaAbonoPublicaEditor } from "@/components/entradas/VentaAbonoPublicaEditor";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type EventDoc = {
  id: string;
  titulo?: string;
  fechaPartido?: string;
  estado?: string;
  precioSocio?: number;
  precioGeneral?: number;
  moneda?: string;
};

type AsientoDoc = {
  id: string;
  estado?: PlateaSeatStatus;
  titularNombre?: string;
  titularSocioId?: string;
  titularEmail?: string;
  titularDni?: string;
};

const ESTADO_LABEL: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reservado (pago en curso)",
  reservado_manual: "Reservado desde panel (sin cobro online)",
  pagado: "Pagado — entrada emitida",
  abonado_fijo: "Abonado (titular fijo)",
  liberado_temporal: "Liberado por abonado para este partido",
};

function EntradasContent({ subcomisionId }: { subcomisionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { app } = useFirebase();
  const firestore = useFirestore();
  const { isSuperAdmin, profile, isReady: profileReady, user } = useUserProfile();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [dialogSeatIds, setDialogSeatIds] = useState<string[]>([]);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tier, setTier] = useState<"socio" | "general">("socio");
  const [payLoading, setPayLoading] = useState(false);
  const [titularModo, setTitularModo] = useState<"socio" | "invitado">("socio");
  const [selectedSocioId, setSelectedSocioId] = useState<string | null>(null);
  const [socioQuery, setSocioQuery] = useState("");
  const [invitadoNombre, setInvitadoNombre] = useState("");
  const [invitadoEmail, setInvitadoEmail] = useState("");
  const [invitadoDni, setInvitadoDni] = useState("");
  const [reservaManualLoading, setReservaManualLoading] = useState(false);

  const { data: school, loading: schoolLoading } = useDoc<Subcomision>(`subcomisiones/${subcomisionId}`);
  const eventsPath = `subcomisiones/${subcomisionId}/plateasEventos`;
  const { data: events, loading: eventsLoading } = useCollection<EventDoc>(eventsPath, {});

  const asientosPath =
    selectedEventId && subcomisionId
      ? `subcomisiones/${subcomisionId}/plateasEventos/${selectedEventId}/asientos`
      : "";
  const { data: asientos } = useCollection<AsientoDoc>(asientosPath, {});

  const sociosPath = subcomisionId ? `subcomisiones/${subcomisionId}/socios` : "";
  const { data: sociosRaw } = useCollection<Socio>(sociosPath, {});

  const layout = useMemo(() => getBasquetPlateasDemoLayout(), []);

  const seatViews: PlateaSeatView[] = useMemo(() => {
    const byId = new Map((asientos ?? []).map((a) => [a.id, a]));
    return layout.map((L) => {
      const doc = byId.get(L.id);
      const estado: PlateaSeatStatus = (doc?.estado as PlateaSeatStatus) ?? "disponible";
      return {
        ...L,
        estado,
        titularNombre: doc?.titularNombre,
      };
    });
  }, [layout, asientos]);

  const sociosFiltrados = useMemo(() => {
    const list = sociosRaw ?? [];
    const q = socioQuery.trim().toLowerCase();
    if (!q) return list.slice(0, 40);
    return list
      .filter((s) => {
        const n = `${s.nombre ?? ""} ${s.apellido ?? ""}`.toLowerCase();
        const dni = String(s.dni ?? "").toLowerCase();
        const em = String(s.email ?? "").toLowerCase();
        const num = String(s.numeroSocio ?? "").toLowerCase();
        return n.includes(q) || dni.includes(q) || em.includes(q) || num.includes(q);
      })
      .slice(0, 50);
  }, [sociosRaw, socioQuery]);

  const dialogSeats = useMemo(
    () =>
      dialogSeatIds
        .map((id) => seatViews.find((s) => s.id === id))
        .filter((s): s is PlateaSeatView => s != null),
    [dialogSeatIds, seatViews]
  );

  const mapHighlightIds = detailOpen ? dialogSeatIds : bulkIds;

  const handleSeatClick = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setBulkIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return [...next];
      });
      return;
    }
    setBulkIds([]);
    setDialogSeatIds([id]);
    setDetailOpen(true);
  }, []);

  const openBulkDialog = useCallback(() => {
    if (bulkIds.length === 0) return;
    setDialogSeatIds([...bulkIds]);
    setDetailOpen(true);
  }, [bulkIds]);

  useEffect(() => {
    if (!detailOpen) return;
    setTitularModo("socio");
    setSelectedSocioId(null);
    setSocioQuery("");
    setInvitadoNombre("");
    setInvitadoEmail("");
    setInvitadoDni("");
  }, [detailOpen]);

  const canManageSchool =
    isSuperAdmin ||
    ((profile?.role === "admin_subcomision" || profile?.role === "encargado_deportivo") &&
      profile.activeSchoolId === subcomisionId);
  const canEditAbonoWeb = isSuperAdmin || profile?.role === "admin_subcomision";
  const isLoading = schoolLoading || !profileReady;

  useEffect(() => {
    if (!isLoading && !canManageSchool) {
      router.replace("/dashboard");
    }
  }, [isLoading, canManageSchool, router]);

  useEffect(() => {
    const pago = searchParams.get("pago");
    if (pago === "ok") {
      toast({
        title: "Pago registrado",
        description: "Si Mercado Pago aprobó el cobro, el asiento se actualizará en segundos.",
      });
    } else if (pago === "error") {
      toast({ variant: "destructive", title: "Pago no completado", description: "Podés reintentar desde el plano." });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!events?.length) return;
    if (!selectedEventId || !events.some((e) => e.id === selectedEventId)) {
      const sorted = [...events].sort((a, b) => (b.fechaPartido ?? "").localeCompare(a.fechaPartido ?? ""));
      const abierto = sorted.find((e) => e.estado === "venta_abierta") ?? sorted[0];
      setSelectedEventId(abierto.id);
    }
  }, [events, selectedEventId]);

  const activeEvent = events?.find((e) => e.id === selectedEventId);
  const primaryDialogSeat = dialogSeats[0];
  const algunDisponibleParaReservaManual = dialogSeats.some((s) =>
    ["disponible", "liberado_temporal"].includes(s.estado)
  );

  const confirmarReservaManual = useCallback(async () => {
    if (!firestore || !user?.uid || !selectedEventId || dialogSeatIds.length === 0) return;

    let titularNombre = "";
    let titularSocioId: string | null = null;
    let titularEmail: string | null = null;
    let titularDni: string | null = null;

    if (titularModo === "socio") {
      if (!selectedSocioId) {
        toast({ variant: "destructive", title: "Elegí un socio de la lista" });
        return;
      }
      const s = sociosRaw?.find((x) => x.id === selectedSocioId);
      if (!s) {
        toast({ variant: "destructive", title: "No se encontró el socio" });
        return;
      }
      titularNombre = `${s.nombre ?? ""} ${s.apellido ?? ""}`.trim();
      titularSocioId = s.id;
      titularEmail = s.email?.trim() || null;
      titularDni = s.dni?.trim() || null;
    } else {
      const nom = invitadoNombre.trim();
      if (!nom) {
        toast({ variant: "destructive", title: "Completá nombre y apellido" });
        return;
      }
      titularNombre = nom;
      titularEmail = invitadoEmail.trim() || null;
      titularDni = invitadoDni.trim() || null;
    }

    const disponibles = dialogSeatIds.filter((sid) => {
      const sv = seatViews.find((v) => v.id === sid);
      return sv && ["disponible", "liberado_temporal"].includes(sv.estado);
    });
    if (disponibles.length === 0) {
      toast({ variant: "destructive", title: "Ningún asiento de la lista está disponible" });
      return;
    }
    if (disponibles.length < dialogSeatIds.length) {
      toast({
        title: "Selección parcial",
        description: `Se reservarán ${disponibles.length} de ${dialogSeatIds.length} (los demás ya están tomados).`,
      });
    }

    setReservaManualLoading(true);
    try {
      const batch = writeBatch(firestore);
      const now = Timestamp.now();
      for (const seatId of disponibles) {
        const ref = doc(
          firestore,
          "subcomisiones",
          subcomisionId,
          "plateasEventos",
          selectedEventId,
          "asientos",
          seatId
        );
        batch.set(
          ref,
          {
            estado: "reservado_manual",
            titularNombre,
            titularSocioId,
            titularEmail,
            titularDni,
            tierReserva: tier,
            reservadoManualEn: now,
            reservadoManualPorUid: user.uid,
            reservaPreferenceId: deleteField(),
            reservaPendingId: deleteField(),
            reservadoDesde: deleteField(),
          },
          { merge: true }
        );
      }
      await batch.commit();
      toast({
        title: "Reserva registrada",
        description:
          disponibles.length === 1
            ? `Asiento a nombre de ${titularNombre}.`
            : `${disponibles.length} asientos a nombre de ${titularNombre}.`,
      });
      setDetailOpen(false);
      setBulkIds([]);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar la reserva",
        description: e instanceof Error ? e.message : "Probá de nuevo.",
      });
    } finally {
      setReservaManualLoading(false);
    }
  }, [
    firestore,
    user?.uid,
    selectedEventId,
    dialogSeatIds,
    seatViews,
    titularModo,
    selectedSocioId,
    sociosRaw,
    invitadoNombre,
    invitadoEmail,
    invitadoDni,
    tier,
    subcomisionId,
    toast,
  ]);

  const iniciarPagoMp = async () => {
    if (!app || !selectedEventId || !activeEvent || dialogSeatIds.length === 0) return;
    const seatIdsParaMp = dialogSeatIds.filter((sid) => {
      const s = seatViews.find((v) => v.id === sid);
      return s && ["disponible", "liberado_temporal"].includes(s.estado);
    });
    if (seatIdsParaMp.length !== dialogSeatIds.length) {
      toast({
        variant: "destructive",
        title: "Selección inválida",
        description: "Hay asientos que ya no están libres para cobro online. Cerrá y elegí de nuevo.",
      });
      return;
    }
    const auth = getAuth(app);
    const authUser = auth.currentUser;
    if (!authUser) {
      toast({ variant: "destructive", title: "Iniciá sesión", description: "Necesitamos identificarte para cobrar." });
      return;
    }
    const mpBuyerSocioId =
      titularModo === "socio" && selectedSocioId ? selectedSocioId : undefined;
    const token = await authUser.getIdToken().catch(() => null);
    if (!token) return;
    setPayLoading(true);
    try {
      const res = await fetch("/api/entradas/iniciar-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subcomisionId,
          eventId: selectedEventId,
          seatIds: seatIdsParaMp,
          tier,
          buyerSocioId: mpBuyerSocioId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { init_point?: string; error?: string };
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "No se pudo iniciar el pago",
          description: data.error ?? res.statusText,
        });
        return;
      }
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } finally {
      setPayLoading(false);
    }
  };

  if (isLoading || !canManageSchool) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const precioSocio = Number(activeEvent?.precioSocio ?? 0);
  const precioGeneral = Number(activeEvent?.precioGeneral ?? 0);
  const monto = tier === "socio" ? precioSocio : precioGeneral;

  const plateasSection = (() => {
    const todosDisponiblesParaCheckoutMp =
      dialogSeats.length > 0 &&
      dialogSeats.every((s) => ["disponible", "liberado_temporal"].includes(s.estado));
    const totalMpMonto = monto * dialogSeats.length;

    return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-headline">{school?.name}</CardTitle>
          <CardDescription className="space-y-2">
            <p>
              Plano interactivo (demo con distribución reducida). Activá la venta creando documentos en Firestore:
              colección <code className="text-xs">plateasEventos</code> y subcolección <code className="text-xs">asientos</code>{" "}
              con los mismos <code className="text-xs">id</code> que el layout (ej. <code className="text-xs">rio-1</code>).
              Conectá Mercado Pago en la subcomisión igual que para cuotas/viajes.
            </p>
            <p className="text-xs">
              <span className="font-medium text-foreground">Abonados:</span>{" "}
              <Link
                href={`/entradas-abonado/${encodeURIComponent(school?.slug ?? subcomisionId)}`}
                className="font-medium text-crsn-orange underline decoration-crsn-orange underline-offset-2 hover:text-crsn-orange-hover"
                target="_blank"
                rel="noopener noreferrer"
              >
                página pública (número de socio)
              </Link>
              .
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventsLoading ? (
            <Skeleton className="h-10 w-full max-w-sm" />
          ) : events && events.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
              <div className="space-y-1 min-w-[200px]">
                <Label>Partido</Label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir partido" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {(e.titulo || "Sin título") +
                          (e.fechaPartido ? ` — ${e.fechaPartido}` : "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeEvent?.estado === "venta_abierta" ? (
                <p className="text-sm text-muted-foreground">
                  Precios: socio ${precioSocio || "—"} · general ${precioGeneral || "—"}{" "}
                  {activeEvent.moneda ? ` ${activeEvent.moneda}` : ""}
                </p>
              ) : (
                <p className="text-sm text-amber-800">Este partido no tiene la venta abierta ({activeEvent?.estado}).</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay partidos cargados en <strong>plateasEventos</strong>. Creá uno con{" "}
              <code className="text-xs">estado: &quot;venta_abierta&quot;</code>,{" "}
              <code className="text-xs">precioSocio</code> y <code className="text-xs">precioGeneral</code>.
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm border bg-white" /> Disponible
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-200 border border-amber-500" /> Reservado (MP)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-violet-100 border border-violet-600" /> Reservado (panel)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-crsn-navy" /> Pagado
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-slate-400" /> Abonado
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 border border-emerald-600" /> Liberado
            </span>
          </div>

          {bulkIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-crsn-navy/20 bg-crsn-navy/5 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">
                {bulkIds.length} asiento{bulkIds.length === 1 ? "" : "s"} seleccionado{bulkIds.length === 1 ? "" : "s"}
              </span>
              <Button type="button" size="sm" className="bg-crsn-orange hover:bg-crsn-orange-hover" onClick={openBulkDialog}>
                Reservar selección
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setBulkIds([])}>
                Limpiar
              </Button>
            </div>
          )}

          <BasquetPlateasMap seats={seatViews} selectedIds={mapHighlightIds} onSeatClick={handleSeatClick} />
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setBulkIds([]);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline">
              {dialogSeats.length <= 1 ? (
                <>
                  Asiento {primaryDialogSeat?.numeroVisible ?? ""}{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    (
                    {primaryDialogSeat?.sector === "rio"
                      ? "Sector Río"
                      : primaryDialogSeat?.sector === "barranca"
                        ? "Sector Barranca"
                        : ""}
                    )
                  </span>
                </>
              ) : (
                <>Reservar {dialogSeats.length} asientos</>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm">
                {dialogSeats.length <= 1 ? (
                  <p>{primaryDialogSeat ? ESTADO_LABEL[primaryDialogSeat.estado] ?? primaryDialogSeat.estado : ""}</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {dialogSeats.map((s) => (
                      <li key={s.id}>
                        Nº {s.numeroVisible} ({s.sector === "rio" ? "Río" : "Barranca"}) —{" "}
                        {ESTADO_LABEL[s.estado] ?? s.estado}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {primaryDialogSeat &&
            (primaryDialogSeat.titularNombre ||
              primaryDialogSeat.estado === "pagado" ||
              primaryDialogSeat.estado === "abonado_fijo" ||
              primaryDialogSeat.estado === "reservado_manual") && (
              <div className="text-sm">
                <span className="text-muted-foreground">Titular / datos: </span>
                {primaryDialogSeat.titularNombre || "—"}
              </div>
            )}

          {algunDisponibleParaReservaManual && (
            <div className="space-y-4 border-t pt-4 text-sm">
              <p className="text-muted-foreground text-xs">
                Reserva desde el club (sin cobro online): elegí un socio del plantel o cargá datos de invitado. La tarifa
                queda registrada para referencia.
              </p>
              <div className="space-y-2">
                <Label>Titular</Label>
                <RadioGroup value={titularModo} onValueChange={(v) => setTitularModo(v as "socio" | "invitado")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="socio" id="tit-socio" />
                    <Label htmlFor="tit-socio" className="font-normal">
                      Socio del plantel
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="invitado" id="tit-inv" />
                    <Label htmlFor="tit-inv" className="font-normal">
                      Invitado / no socio (cargar datos a mano)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {titularModo === "socio" ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5" />
                    Buscar socio
                  </Label>
                  <Input
                    placeholder="Nombre, DNI, email o nº de socio"
                    value={socioQuery}
                    onChange={(e) => setSocioQuery(e.target.value)}
                  />
                  <ScrollArea className="h-40 rounded-md border">
                    <div className="p-1 space-y-1">
                      {sociosFiltrados.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">Sin resultados o escribí para filtrar.</p>
                      ) : (
                        sociosFiltrados.map((s) => {
                          const label = `${s.apellido ?? ""} ${s.nombre ?? ""}`.trim() || s.email || s.id;
                          const active = selectedSocioId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedSocioId(s.id)}
                              className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                                active ? "bg-crsn-navy text-white" : "hover:bg-muted"
                              }`}
                            >
                              <span className="font-medium">{label}</span>
                              {s.numeroSocio ? <span className="opacity-80"> · Nº {s.numeroSocio}</span> : null}
                              {s.dni ? <span className="block opacity-80">DNI {s.dni}</span> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1">
                    <Label>Nombre y apellido</Label>
                    <Input value={invitadoNombre} onChange={(e) => setInvitadoNombre(e.target.value)} placeholder="Tal como en el DNI" />
                  </div>
                  <div className="space-y-1">
                    <Label>DNI (opcional)</Label>
                    <Input value={invitadoDni} onChange={(e) => setInvitadoDni(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email (opcional)</Label>
                    <Input
                      type="email"
                      value={invitadoEmail}
                      onChange={(e) => setInvitadoEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tarifa de referencia</Label>
                <RadioGroup value={tier} onValueChange={(v) => setTier(v as "socio" | "general")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="socio" id="tier-socio" />
                    <Label htmlFor="tier-socio" className="font-normal">
                      Socio — ${precioSocio || "0"}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="tier-general" />
                    <Label htmlFor="tier-general" className="font-normal">
                      General — ${precioGeneral || "0"}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                type="button"
                className="w-full bg-crsn-navy hover:bg-crsn-navy/90"
                disabled={reservaManualLoading}
                onClick={() => void confirmarReservaManual()}
              >
                {reservaManualLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar reserva (sin cobro online)"}
              </Button>
            </div>
          )}

          {todosDisponiblesParaCheckoutMp && activeEvent?.estado === "venta_abierta" && monto > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                {dialogSeats.length === 1
                  ? "Cobro con Mercado Pago. Si elegiste socio arriba, queda vinculado al pendiente de pago."
                  : `Un solo link para pagar ${dialogSeats.length} asientos — total aprox. $${totalMpMonto} ${activeEvent.moneda ?? "ARS"}. El titular en Firestore será quien pagó; podés asociar socio arriba para el vínculo en el pendiente.`}
              </p>
              <Button
                type="button"
                className="w-full bg-crsn-orange hover:bg-crsn-orange-hover"
                disabled={payLoading}
                onClick={() => void iniciarPagoMp()}
              >
                {payLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dialogSeats.length === 1 ? (
                  "Pagar con Mercado Pago"
                ) : (
                  `Pagar ${dialogSeats.length} asientos con Mercado Pago`
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  })();

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={`/dashboard/subcomisiones/${subcomisionId}`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <h1 className="text-xl font-bold font-headline sm:text-3xl truncate flex items-center gap-2">
            <Ticket className="h-7 w-7 shrink-0 text-crsn-navy" />
            Venta de entradas
          </h1>
        </div>
      </div>

      {canEditAbonoWeb ? (
        <Tabs defaultValue="plateas" className="w-full">
          <TabsList className="flex w-full flex-wrap gap-1 p-1 h-auto bg-card">
            <TabsTrigger
              value="plateas"
              className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 flex-1 min-w-[100px]"
            >
              <Ticket className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Plateas por partido</span>
            </TabsTrigger>
            <TabsTrigger
              value="abono-web"
              className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 flex-1 min-w-[100px]"
            >
              <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Abono web</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plateas" className="mt-4 space-y-4">
            {plateasSection}
          </TabsContent>
          <TabsContent value="abono-web" className="mt-4">
            {school ? (
              <VentaAbonoPublicaEditor subcomisionId={subcomisionId} school={school} />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">{plateasSection}</div>
      )}
    </div>
  );
}

export default function EntradasPlateasPage() {
  const params = useParams();
  const subcomisionId = params.subcomisionId as string;

  return (
    <SubcomisionModuleGuard moduleKey="ventaEntradas" schoolId={subcomisionId}>
      <EntradasContent subcomisionId={subcomisionId} />
    </SubcomisionModuleGuard>
  );
}
