"use client";

import { useState, useEffect, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ExternalLink, Download } from "lucide-react";
import type { DelinquentInfo } from "@/lib/types";

const REGISTRATION_PERIOD = "inscripcion";

const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
  { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
];

function formatPeriodLabel(period: string): string {
  if (period === REGISTRATION_PERIOD) return "Inscripción";
  const ropaMatch = period.match(/^ropa-(\d+)$/);
  if (ropaMatch) return `Pago de ropa (${ropaMatch[1]})`;
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const [y, m] = period.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

function getYears(): number[] {
  const current = new Date().getFullYear();
  const start = 2024;
  const end = Math.max(current + 1, start + 2);
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

interface DelinquentsTabProps {
  schoolId: string;
  getToken: () => Promise<string | null>;
}

export function DelinquentsTab({ schoolId, getToken }: DelinquentsTabProps) {
  const [delinquents, setDelinquents] = useState<DelinquentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Concepto: "all" | "inscripcion" | "monthly" | "clothing" */
  const [conceptFilter, setConceptFilter] = useState("");
  /** Subfiltro: ropa-N para ropa; YYYY-MM para cuota mensual */
  const [periodFilter, setPeriodFilter] = useState("");
  const [manualDialog, setManualDialog] = useState<DelinquentInfo | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleExportCsv = () => {
    const escape = (v: string | number | undefined) => {
      if (v == null || v === "") return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cols = ["Jugador", "Email", "Período", "Días mora", "Monto", "Moneda", "Estado", "Teléfono tutor", "Nombre tutor"];
    const rows = delinquents.map((d) => [
      escape(d.playerName),
      escape(d.playerEmail),
      escape(formatPeriodLabel(d.period)),
      escape(d.daysOverdue),
      escape(d.amount),
      escape(d.currency),
      escape(d.status === "suspended" ? "Suspendido" : "En mora"),
      escape(d.tutorContact?.phone),
      escape(d.tutorContact?.name),
    ]);
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `morosos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportación completada", description: `${delinquents.length} registros exportados.` });
  };

  const fetchDelinquents = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setFetchError(null);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setFetchError("Sesión expirada. Volvé a iniciar sesión.");
      return;
    }
    try {
      const params = new URLSearchParams({ schoolId });
      const concept = conceptFilter || "";
      const period = periodFilter || "";
      if (concept) params.set("concept", concept);
      if (period) params.set("period", period);
      const res = await fetch(`/api/payments/delinquents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error ??
          (res.status === 401 ? "Sesión expirada. Volvé a iniciar sesión." : null) ??
          (res.status === 400 ? "Falta seleccionar la escuela." : null) ??
          (res.status === 503 ? "Los índices se están creando. Volvé a intentar en unos minutos." : null) ??
          `Error al cargar morosos (${res.status})`;
        setFetchError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
        return;
      }
      const list = data.delinquents ?? [];
      setDelinquents(
        list.map((d: DelinquentInfo & { dueDate: string }) => ({
          ...d,
          dueDate: new Date(d.dueDate),
        }))
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudieron cargar los morosos";
      setFetchError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, conceptFilter, periodFilter, getToken, toast]);

  useEffect(() => {
    fetchDelinquents();
  }, [fetchDelinquents]);

  const handleCreateIntent = async (d: DelinquentInfo) => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: "mercadopago",
          playerId: d.playerId,
          schoolId: d.schoolId,
          period: d.period,
          amount: d.amount,
          currency: d.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear link");
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
      }
    } catch (e) {
      toast({ title: "Error", description: "No se pudo generar el link de pago", variant: "destructive" });
    }
  };

  const handleMarkManual = async () => {
    if (!manualDialog) return;
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Monto inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerId: manualDialog.playerId,
          schoolId: manualDialog.schoolId,
          period: manualDialog.period,
          amount,
          currency: manualDialog.currency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar");
      }
      toast({ title: "Listo", description: "Pago registrado correctamente" });
      setManualDialog(null);
      setManualAmount("");
      fetchDelinquents();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error al registrar pago",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={loading || delinquents.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Select
          value={conceptFilter || "all"}
          onValueChange={(v) => {
            setConceptFilter(v === "all" ? "" : v);
            setPeriodFilter("");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Concepto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los conceptos</SelectItem>
            <SelectItem value="inscripcion">Inscripción</SelectItem>
            <SelectItem value="monthly">Cuota mensual</SelectItem>
            <SelectItem value="clothing">Ropa</SelectItem>
          </SelectContent>
        </Select>
        {conceptFilter === "monthly" && (
          <>
            <Select
              value={periodFilter ? periodFilter.slice(5, 7) : "all"}
              onValueChange={(m) =>
                setPeriodFilter(
                  m === "all"
                    ? ""
                    : `${periodFilter ? periodFilter.slice(0, 4) : new Date().getFullYear()}-${m}`
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={periodFilter ? periodFilter.slice(0, 4) : "all"}
              onValueChange={(y) =>
                setPeriodFilter(
                  y === "all"
                    ? ""
                    : `${y}-${periodFilter ? periodFilter.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, "0")}`
                )
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {getYears().map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {conceptFilter === "clothing" && (
          <Select value={periodFilter || "all"} onValueChange={(v) => setPeriodFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Cuota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ropa-1">Cuota 1</SelectItem>
              <SelectItem value="ropa-2">Cuota 2</SelectItem>
              <SelectItem value="ropa-3">Cuota 3</SelectItem>
              <SelectItem value="ropa-4">Cuota 4</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : fetchError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-2">{fetchError}</p>
          <Button variant="outline" size="sm" onClick={() => fetchDelinquents()}>
            Reintentar
          </Button>
        </div>
      ) : delinquents.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
          No hay morosos en esta escuela
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border min-w-0">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Jugador</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Período</TableHead>
                <TableHead className="text-xs sm:text-sm whitespace-nowrap">Días mora</TableHead>
                <TableHead className="text-xs sm:text-sm">Monto</TableHead>
                <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                <TableHead className="text-xs sm:text-sm text-right w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delinquents.map((d) => (
                <TableRow key={`${d.playerId}-${d.period}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{d.playerName}</p>
                      {d.playerEmail && (
                        <p className="text-xs text-muted-foreground">{d.playerEmail}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatPeriodLabel(d.period)}</TableCell>
                  <TableCell>
                    <span className={d.daysOverdue >= 30 ? "font-semibold text-destructive" : ""}>
                      {d.daysOverdue} días
                    </span>
                  </TableCell>
                  <TableCell>
                    {d.currency} {d.amount.toLocaleString("es-AR")}
                    {d.isProrated && (
                      <span className="ml-1 text-xs text-muted-foreground">(prorrata mes ingreso)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.status === "suspended" ? "destructive" : "secondary"}>
                      {d.status === "suspended" ? "Suspendido" : "En mora"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateIntent(d)}
                      >
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Link de pago
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setManualDialog(d);
                          setManualAmount(String(d.amount));
                        }}
                      >
                        Pago manual
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!manualDialog} onOpenChange={() => setManualDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pago manual</DialogTitle>
            <DialogDescription>
              Registrar un pago realizado fuera del sistema para {manualDialog?.playerName} -
              período {manualDialog?.period}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkManual} disabled={submitting}>
              {submitting ? "Guardando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
