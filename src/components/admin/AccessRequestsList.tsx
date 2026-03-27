"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";
import { usePendingAccessRequests } from "@/hooks/use-pending-access-requests";
import type { AccessRequest, Socio } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, Loader2, Search, UserPlus, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ActionState = { type: "approving" | "rejecting"; requestId: string } | null;

export function AccessRequestsList() {
  const { profile, activeSchoolId, isReady } = useUserProfile();
  const { toast } = useToast();
  const { app } = useFirebase();

  const { data: requests, loading, error, refetch } = usePendingAccessRequests(
    isReady && !!activeSchoolId
  );

  const { data: socios } = useCollection<Socio>(
    isReady && activeSchoolId ? `subcomisiones/${activeSchoolId}/socios` : "",
    {}
  );
  const activeSocios = (socios ?? []).filter((p: Socio) => !p.archived);

  const [actionState, setActionState] = useState<ActionState>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerPopoverOpen, setPlayerPopoverOpen] = useState(false);
  const [approveDialog, setApproveDialog] = useState<{
    request: AccessRequest;
    linkToPlayerId: string | "new";
  } | null>(null);

  const handleApprove = async (request: AccessRequest, linkToPlayerId: string | "new") => {
    if (!profile || !activeSchoolId || !app) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se puede aprobar la solicitud.",
      });
      return;
    }
    setActionState({ type: "approving", requestId: request.id });

    try {
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) throw new Error("No autenticado");
      const token = await user.getIdToken();
      const res = await fetch(`/api/access-requests/${request.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          activeSchoolId,
          linkToPlayerId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? res.statusText);
      }
      toast({
        title: "Solicitud aprobada",
        description:
          linkToPlayerId === "new"
            ? `Se creó el jugador y ${request.email} ya puede iniciar sesión.`
            : `Se vinculó ${request.email} al jugador. Ya puede iniciar sesión.`,
      });
      setApproveDialog(null);
      await refetch();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo aprobar la solicitud. Inténtalo de nuevo.",
      });
    } finally {
      setActionState(null);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    if (!app) return;
    setActionState({ type: "rejecting", requestId: request.id });
    try {
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) throw new Error("No autenticado");
      const token = await user.getIdToken();
      const res = await fetch(`/api/access-requests/${request.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? res.statusText);
      }
      toast({
        title: "Solicitud rechazada",
        description: `Se rechazó la solicitud de ${request.email}.`,
      });
      await refetch();
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo rechazar la solicitud.",
      });
    } finally {
      setActionState(null);
      setApproveDialog(null);
    }
  };

  const pendingList = requests?.filter((r) => r.status === "pending") ?? [];
  const sortedPending = [...pendingList].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );
  // Una sola solicitud por email (la más reciente) para evitar duplicados en la UI
  const dedupedByEmail = sortedPending.reduce<AccessRequest[]>((acc, req) => {
    const emailNorm = req.email.trim().toLowerCase();
    if (!acc.some((r) => r.email.trim().toLowerCase() === emailNorm)) {
      acc.push(req);
    }
    return acc;
  }, []);

  if (!isReady || !activeSchoolId) return null;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader></Card>
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader></Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>No se pueden cargar las solicitudes de acceso.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Solicitudes de acceso (jugadores)
          </CardTitle>
          <CardDescription>
            Usuarios que ya tienen cuenta y pidieron poder entrar como jugador. Aprobá para vincular su email a un jugador de tu escuela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dedupedByEmail.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay solicitudes de acceso pendientes.</p>
          ) : (
            <ul className="space-y-3">
              {dedupedByEmail.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{req.displayName || req.email}</p>
                    <p className="text-sm text-muted-foreground">{req.email}</p>
                    {req.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(req.createdAt, "PPP p", { locale: es })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setApproveDialog({ request: req, linkToPlayerId: "new" })}
                      disabled={!!actionState}
                    >
                      {actionState?.requestId === req.id && actionState?.type === "approving" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req)}
                      disabled={!!actionState}
                    >
                      {actionState?.requestId === req.id && actionState?.type === "rejecting" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4 mr-1" />
                      )}
                      Rechazar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!approveDialog}
        onOpenChange={(open) => {
          if (!open) {
            setApproveDialog(null);
            setPlayerSearch("");
            setPlayerPopoverOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar solicitud de acceso</DialogTitle>
            <DialogDescription>
              {approveDialog && (
                <>Vincular <strong>{approveDialog.request.email}</strong> a un jugador de tu escuela.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {approveDialog && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Jugador</Label>
                <Popover open={playerPopoverOpen} onOpenChange={setPlayerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {approveDialog.linkToPlayerId === "new"
                        ? "Crear nuevo jugador con este email"
                        : (() => {
                            const sel = activeSocios.find((p) => p.id === approveDialog.linkToPlayerId);
                            return sel ? `${sel.firstName} ${sel.lastName}` : "Buscar jugador…";
                          })()}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="flex items-center border-b px-2">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o apellido…"
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <ScrollArea className="max-h-[240px]">
                      <div className="p-1">
                        <button
                          type="button"
                          className="flex w-full items-center rounded-sm px-2 py-2 text-sm hover:bg-accent"
                          onClick={() => {
                            setApproveDialog({ ...approveDialog, linkToPlayerId: "new" });
                            setPlayerSearch("");
                            setPlayerPopoverOpen(false);
                          }}
                        >
                          <span className="font-medium">Crear nuevo jugador con este email</span>
                        </button>
                        {(() => {
                          const q = playerSearch.trim().toLowerCase();
                          const filtered = activeSocios.filter((p) => {
                            if (!q) return true;
                            const full = `${(p.firstName || "").toLowerCase()} ${(p.lastName || "").toLowerCase()}`;
                            return full.includes(q) || full.split(/\s+/).some((w) => w.startsWith(q));
                          });
                          return filtered.length > 0 ? (
                            filtered.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="flex w-full items-center rounded-sm px-2 py-2 text-sm hover:bg-accent"
                                onClick={() => {
                                  setApproveDialog({ ...approveDialog, linkToPlayerId: p.id });
                                  setPlayerSearch("");
                                  setPlayerPopoverOpen(false);
                                }}
                              >
                                {p.firstName} {p.lastName}
                              </button>
                            ))
                          ) : (
                            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                              No hay jugadores que coincidan.
                            </p>
                          );
                        })()}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Escribí para buscar por nombre o apellido.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>
              Cancelar
            </Button>
            {approveDialog && (
              <Button
                onClick={() => handleApprove(approveDialog.request, approveDialog.linkToPlayerId)}
                disabled={!!actionState}
              >
                {actionState?.type === "approving" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Aprobar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
