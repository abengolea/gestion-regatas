"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EscudoCRSN } from "@/components/icons/EscudoCRSN";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, LogOut, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PlateaSeatStatus } from "@/lib/types/entradas";

const SESSION_STORAGE_KEY = "entradas_abonado_session_v1";

type Contexto = {
  slug: string;
  subcomisionId: string;
  subcomisionNombre: string;
};

type VerificarOk = {
  token: string;
  subcomisionId: string;
  subcomisionNombre: string;
  socioId: string;
  numeroSocio: string;
  nombre: string;
};

type PartidoRow = {
  eventId: string;
  titulo: string;
  fechaPartido: string;
  estado: string;
  precioSocio: number;
  precioGeneral: number;
  moneda: string;
  misAsientos: {
    seatId: string;
    numeroVisible: number;
    sector: string;
    estado: PlateaSeatStatus;
    titularNombre?: string;
  }[];
};

const ESTADO_LABEL: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reserva / pago en curso",
  reservado_manual: "Reservado",
  pagado: "Entrada confirmada (pagada)",
  abonado_fijo: "Tu abono — lugar reservado",
  liberado_temporal: "Liberaste el lugar para este partido",
};

function sectorLabel(sector: string) {
  if (sector === "rio") return "Sector Río";
  if (sector === "barranca") return "Sector Barranca";
  return sector || "—";
}

function readStoredSession(): VerificarOk | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as VerificarOk;
    if (!j.token || !j.numeroSocio) return null;
    return j;
  } catch {
    return null;
  }
}

function writeStoredSession(s: VerificarOk) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
}

function clearStoredSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function EntradasAbonadoCliente({ slug }: { slug: string }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [contextoError, setContextoError] = useState<string | null>(null);
  const [contextoLoading, setContextoLoading] = useState(true);

  const [numeroInput, setNumeroInput] = useState("");
  const [verificarLoading, setVerificarLoading] = useState(false);
  const [sesion, setSesion] = useState<VerificarOk | null>(null);

  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [partidosLoading, setPartidosLoading] = useState(false);
  const [tier, setTier] = useState<"socio" | "general">("socio");
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setContextoLoading(true);
      setContextoError(null);
      try {
        const res = await fetch(`/api/entradas/abonado/contexto?slug=${encodeURIComponent(slug)}`);
        const j = (await res.json()) as Contexto & { error?: string };
        if (!res.ok) {
          if (!cancelled) setContextoError(j.error ?? "No disponible");
          return;
        }
        if (!cancelled) setContexto(j as Contexto);
      } catch (e) {
        if (!cancelled) setContextoError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setContextoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const pago = searchParams.get("pago");
    if (pago === "ok") {
      toast({
        title: "Pago recibido",
        description: "Si Mercado Pago aprobó la operación, tu platea se actualizará en breve.",
      });
    } else if (pago === "error") {
      toast({ variant: "destructive", title: "Pago no completado", description: "Podés intentar de nuevo." });
    } else if (pago === "pendiente") {
      toast({
        title: "Pago pendiente",
        description: "Mercado Pago está procesando el pago.",
      });
    }
  }, [searchParams, toast]);

  const loadPartidos = useCallback(
    async (token: string) => {
      setPartidosLoading(true);
      try {
        const res = await fetch("/api/entradas/abonado/partidos", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json()) as { partidos?: PartidoRow[]; error?: string };
        if (res.status === 401) {
          clearStoredSession();
          setSesion(null);
          setPartidos([]);
          toast({
            variant: "destructive",
            title: "Sesión vencida",
            description: j.error ?? "Ingresá de nuevo tu número de socio.",
          });
          return;
        }
        if (!res.ok) {
          toast({ variant: "destructive", title: "No se pudo cargar", description: j.error ?? res.statusText });
          return;
        }
        setPartidos(j.partidos ?? []);
      } finally {
        setPartidosLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!contexto) return;
    const stored = readStoredSession();
    if (!stored) return;
    if (stored.subcomisionId !== contexto.subcomisionId) {
      clearStoredSession();
      setSesion(null);
      setPartidos([]);
      toast({
        title: "Sede distinta",
        description: "Volvé a ingresar tu número de socio para esta sede.",
      });
      return;
    }
    setSesion(stored);
    void loadPartidos(stored.token);
  }, [contexto, loadPartidos]); // toast usado en la rama mismatch sin incluirlo (evita re-hidratación)

  const verificar = async () => {
    if (!numeroInput.trim()) {
      toast({ variant: "destructive", title: "Ingresá tu número de socio" });
      return;
    }
    setVerificarLoading(true);
    try {
      const res = await fetch("/api/entradas/abonado/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, numeroSocio: numeroInput.trim() }),
      });
      const j = (await res.json()) as VerificarOk & { error?: string };
      if (!res.ok) {
        toast({ variant: "destructive", title: "No pudimos continuar", description: j.error ?? res.statusText });
        return;
      }
      writeStoredSession(j);
      setSesion(j);
      await loadPartidos(j.token);
    } finally {
      setVerificarLoading(false);
    }
  };

  const cerrarSesion = () => {
    clearStoredSession();
    setSesion(null);
    setPartidos([]);
    setNumeroInput("");
  };

  const liberar = async (eventId: string, seatId: string) => {
    const token = sesion?.token;
    if (!token) return;
    const key = `lib-${eventId}-${seatId}`;
    setActionKey(key);
    try {
      const res = await fetch("/api/entradas/abonado/liberar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, seatId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ variant: "destructive", title: "No se pudo liberar", description: j.error });
        return;
      }
      toast({
        title: "Listo",
        description: "Liberaste tu lugar para este partido. Podés volver a tomarlo si sigue disponible.",
      });
      await loadPartidos(token);
    } finally {
      setActionKey(null);
    }
  };

  const retomar = async (eventId: string, seatId: string) => {
    const token = sesion?.token;
    if (!token) return;
    const key = `ret-${eventId}-${seatId}`;
    setActionKey(key);
    try {
      const res = await fetch("/api/entradas/abonado/retomar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, seatId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ variant: "destructive", title: "No se pudo retomar", description: j.error });
        return;
      }
      toast({ title: "Listo", description: "Tu lugar vuelve a figurar como abonado para este partido." });
      await loadPartidos(token);
    } finally {
      setActionKey(null);
    }
  };

  const iniciarPago = async (eventId: string, seatId: string) => {
    const token = sesion?.token;
    if (!token) return;
    const key = `pay-${eventId}-${seatId}`;
    setPayingKey(key);
    try {
      const res = await fetch("/api/entradas/abonado/iniciar-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, seatId, tier, returnSlug: slug }),
      });
      const j = (await res.json()) as { init_point?: string; error?: string };
      if (!res.ok) {
        toast({ variant: "destructive", title: "No se pudo iniciar el pago", description: j.error });
        return;
      }
      if (j.init_point) window.location.href = j.init_point;
    } finally {
      setPayingKey(null);
    }
  };

  if (contextoLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F6F8]">
        <Loader2 className="h-8 w-8 animate-spin text-crsn-navy" aria-hidden />
      </div>
    );
  }

  if (contextoError || !contexto) {
    return (
      <div className="min-h-[100dvh] bg-[#F5F6F8] px-4 py-10">
        <Card className="mx-auto max-w-md border-crsn-navy/15">
          <CardHeader>
            <CardTitle className="font-headline text-[#1A1A2E]">Entradas abonados</CardTitle>
            <CardDescription className="text-[#1A1A2E]/80">{contextoError ?? "No se encontró la sede."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F6F8] text-[#1A1A2E]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3 px-4 py-4">
          <EscudoCRSN size={40} className="shrink-0" />
          <div className="text-left">
            <p className="font-headline text-lg leading-tight text-[#1A1A2E]">Mis plateas</p>
            <p className="text-sm text-[#1A1A2E]/75">{contexto.subcomisionNombre}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {!sesion ? (
          <Card className="border-crsn-navy/15 shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline text-[#1A1A2E] flex items-center gap-2 text-base">
                <Ticket className="h-5 w-5 text-crsn-orange" />
                Ingresá tu número de socio
              </CardTitle>
              <CardDescription className="text-[#1A1A2E]/80">
                Sin contraseña por ahora: con tu Nº de socio accedés a tus plateas de abono para cada partido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="numero-socio">Número de socio</Label>
                <Input
                  id="numero-socio"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej. 1234"
                  value={numeroInput}
                  onChange={(e) => setNumeroInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="w-full bg-crsn-orange text-white hover:bg-crsn-orange-hover hover:text-white"
                disabled={verificarLoading}
                onClick={() => void verificar()}
              >
                {verificarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
              <p className="text-xs text-[#1A1A2E]/70">
                Cualquiera que conozca tu número podría gestionar estos datos. Pronto sumaremos cuenta y clave.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-crsn-navy/10 bg-white px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-[#1A1A2E]">{sesion.nombre}</p>
                <p className="text-[#1A1A2E]/70">Nº socio {sesion.numeroSocio}</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={cerrarSesion}>
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </Button>
            </div>

            {partidosLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-crsn-navy" />
              </div>
            ) : partidos.length === 0 ? (
              <Card className="border-crsn-navy/15">
                <CardContent className="py-8 text-center text-sm text-[#1A1A2E]/80">
                  No hay partidos con plateas registradas a tu nombre en esta sede. Si acabás de abonar, puede tardar en
                  actualizarse; consultá en secretaría.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {partidos.map((p) => (
                  <Card key={p.eventId} className="border-crsn-navy/15 shadow-sm overflow-hidden">
                    <CardHeader className="pb-2 border-b bg-neutral-50">
                      <CardTitle className="font-headline text-base text-[#1A1A2E]">{p.titulo}</CardTitle>
                      <CardDescription className="text-[#1A1A2E]/75">
                        {p.fechaPartido ? `${p.fechaPartido} · ` : ""}
                        {p.estado === "venta_abierta" ? "Venta abierta" : `Estado: ${p.estado}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {p.misAsientos.map((a) => (
                        <div
                          key={a.seatId}
                          className="rounded-md border border-crsn-navy/10 bg-white p-3 space-y-3"
                        >
                          <div className="flex flex-wrap justify-between gap-2 text-sm">
                            <div>
                              <p className="font-medium text-foreground">
                                Platea Nº {a.numeroVisible || "—"}{" "}
                                <span className="font-normal text-[#1A1A2E]/65">
                                  ({sectorLabel(a.sector)})
                                </span>
                              </p>
                              <p className="text-[#1A1A2E]/75">{ESTADO_LABEL[a.estado] ?? a.estado}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            {a.estado === "abonado_fijo" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full border-amber-600 text-amber-900 hover:bg-amber-50"
                                disabled={actionKey === `lib-${p.eventId}-${a.seatId}`}
                                onClick={() => void liberar(p.eventId, a.seatId)}
                              >
                                {actionKey === `lib-${p.eventId}-${a.seatId}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "No usaré mi lugar este partido"
                                )}
                              </Button>
                            )}

                            {a.estado === "liberado_temporal" && (
                              <Button
                                type="button"
                                size="sm"
                                className="w-full bg-crsn-navy text-white hover:bg-[#243570] hover:text-white"
                                disabled={actionKey === `ret-${p.eventId}-${a.seatId}`}
                                onClick={() => void retomar(p.eventId, a.seatId)}
                              >
                                {actionKey === `ret-${p.eventId}-${a.seatId}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Volver a usar mi lugar"
                                )}
                              </Button>
                            )}

                            {a.estado === "disponible" && p.estado === "venta_abierta" && (
                              <div className="space-y-2 border-t pt-3 mt-1">
                                <p className="text-xs text-[#1A1A2E]/75">
                                  Este lugar figura disponible con tu nombre. Si corresponde pagar la entrada del
                                  partido, elegí tarifa y aboná con Mercado Pago.
                                </p>
                                <RadioGroup
                                  value={tier}
                                  onValueChange={(v) => setTier(v as "socio" | "general")}
                                  className="flex gap-4"
                                >
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem value="socio" id={`soc-${p.eventId}-${a.seatId}`} />
                                    <Label
                                      htmlFor={`soc-${p.eventId}-${a.seatId}`}
                                      className="font-normal text-xs text-[#1A1A2E]"
                                    >
                                      Socio ${p.precioSocio || "—"}
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem value="general" id={`gen-${p.eventId}-${a.seatId}`} />
                                    <Label
                                      htmlFor={`gen-${p.eventId}-${a.seatId}`}
                                      className="font-normal text-xs text-[#1A1A2E]"
                                    >
                                      General ${p.precioGeneral || "—"}
                                    </Label>
                                  </div>
                                </RadioGroup>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="w-full bg-crsn-orange text-white hover:bg-crsn-orange-hover hover:text-white"
                                  disabled={payingKey === `pay-${p.eventId}-${a.seatId}`}
                                  onClick={() => void iniciarPago(p.eventId, a.seatId)}
                                >
                                  {payingKey === `pay-${p.eventId}-${a.seatId}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Pagar entrada con Mercado Pago"
                                  )}
                                </Button>
                              </div>
                            )}

                            {a.estado === "pagado" && (
                              <p className="text-xs text-emerald-800">Entrada lista para este partido.</p>
                            )}
                            {a.estado === "reservado" && (
                              <p className="text-xs text-amber-800">Pago en proceso. Esperá la confirmación.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
