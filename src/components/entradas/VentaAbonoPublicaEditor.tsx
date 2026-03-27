"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useFirestore, useUserProfile } from "@/firebase";
import type { Subcomision } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Loader2 } from "lucide-react";

type Props = {
  subcomisionId: string;
  school: Subcomision;
};

export function VentaAbonoPublicaEditor({ subcomisionId, school }: Props) {
  const firestore = useFirestore();
  const { user } = useUserProfile();
  const { toast } = useToast();

  const v = school.ventaAbonoPublica;
  const [activa, setActiva] = useState(Boolean(v?.activa));
  const [slug, setSlug] = useState(v?.slug ?? "");
  const [titulo, setTitulo] = useState(v?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(v?.descripcion ?? "");
  const [precioSocio, setPrecioSocio] = useState(
    v?.precioSocio !== undefined ? String(v.precioSocio) : ""
  );
  const [precioGeneral, setPrecioGeneral] = useState(
    v?.precioGeneral !== undefined ? String(v.precioGeneral) : ""
  );
  const [moneda, setMoneda] = useState(v?.moneda ?? "ARS");
  const [plateasEventoMapaId, setPlateasEventoMapaId] = useState(v?.plateasEventoMapaId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiva(Boolean(school.ventaAbonoPublica?.activa));
    setSlug(school.ventaAbonoPublica?.slug ?? "");
    setTitulo(school.ventaAbonoPublica?.titulo ?? "");
    setDescripcion(school.ventaAbonoPublica?.descripcion ?? "");
    setPrecioSocio(
      school.ventaAbonoPublica?.precioSocio !== undefined
        ? String(school.ventaAbonoPublica.precioSocio)
        : ""
    );
    setPrecioGeneral(
      school.ventaAbonoPublica?.precioGeneral !== undefined
        ? String(school.ventaAbonoPublica.precioGeneral)
        : ""
    );
    setMoneda(school.ventaAbonoPublica?.moneda ?? "ARS");
    setPlateasEventoMapaId(school.ventaAbonoPublica?.plateasEventoMapaId ?? "");
  }, [school.ventaAbonoPublica, subcomisionId]);

  const segmentoUrl = useMemo(() => {
    const s = slug.trim();
    if (s) return s;
    if (school.slug?.trim()) return school.slug.trim();
    return subcomisionId;
  }, [slug, school.slug, subcomisionId]);

  const urlPublica = useMemo(() => {
    const base =
      typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "";
    return `${base.replace(/\/$/, "")}/abonos-plateas/${encodeURIComponent(segmentoUrl)}`;
  }, [segmentoUrl]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(urlPublica);
      toast({ title: "Link copiado" });
    } catch {
      toast({ variant: "destructive", title: "No se pudo copiar" });
    }
  };

  const guardar = async () => {
    if (!user?.uid) return;
    const ps = Math.round(Number(precioSocio.replace(",", ".")) || 0);
    const pg = Math.round(Number(precioGeneral.replace(",", ".")) || 0);
    if (activa && (!titulo.trim() || (ps <= 0 && pg <= 0))) {
      toast({
        variant: "destructive",
        title: "Completá título y al menos un precio",
        description: "Para activar la venta hace falta título y precio socio o precio general mayor a 0.",
      });
      return;
    }
    if (activa && !plateasEventoMapaId.trim()) {
      toast({
        variant: "destructive",
        title: "Indicá el partido para el plano",
        description:
          "Es el id del documento en plateasEventos (mismo que usás en venta de entradas). Así el comprador elige la platea antes de pagar.",
      });
      return;
    }
    setSaving(true);
    try {
      const ref = doc(firestore, "subcomisiones", subcomisionId);
      await updateDoc(ref, {
        ventaAbonoPublica: {
          activa,
          slug: slug.trim(),
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          precioSocio: ps,
          precioGeneral: pg,
          moneda: moneda.trim().toUpperCase() || "ARS",
          plateasEventoMapaId: plateasEventoMapaId.trim() || "",
        },
      });
      toast({
        title: "Configuración guardada",
        description: activa
          ? "El link público ya puede usarse (Mercado Pago debe estar conectado en esta subcomisión)."
          : "La venta web quedó desactivada.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Revisá permisos en Firestore.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-lg sm:text-xl">Venta de abonos (web pública)</CardTitle>
        <CardDescription>
          Definí precios, moneda y texto. La gente compra sin login en el link de abajo (Mercado Pago
          Checkout Pro, misma cuenta que cuotas/viajes de esta subcomisión).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">Link público</Label>
            <p className="font-mono text-xs break-all text-crsn-navy">{urlPublica}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copiarLink()}>
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={urlPublica} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Segmento de URL usado: <strong>{segmentoUrl}</strong>
          {slug.trim()
            ? " (ventaAbonoPublica.slug)"
            : school.slug?.trim()
              ? " (slug de la subcomisión)"
              : " (id del documento en Firestore)"}
        </p>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="abono-activa" className="text-base font-medium">
              Venta activa
            </Label>
            <p className="text-sm text-muted-foreground">Si está apagado, el link muestra «no disponible».</p>
          </div>
          <Switch id="abono-activa" checked={activa} onCheckedChange={setActiva} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abono-slug">Slug opcional en la URL</Label>
          <Input
            id="abono-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={school.slug || subcomisionId}
          />
          <p className="text-xs text-muted-foreground">
            Si lo dejás vacío, se usa el slug de la subcomisión o el id <code className="text-[10px]">{subcomisionId}</code>.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="abono-titulo">Título de la campaña</Label>
          <Input
            id="abono-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Abono plateas temporada 2025"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abono-desc">Descripción (opcional)</Label>
          <Textarea
            id="abono-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Texto breve para quien entra al link"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="abono-mapa-evento">ID del partido para el plano (plateasEventos)</Label>
          <Input
            id="abono-mapa-evento"
            value={plateasEventoMapaId}
            onChange={(e) => setPlateasEventoMapaId(e.target.value)}
            placeholder="Ej. temporada-2026 o el mismo id que en venta de entradas"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Obligatorio con venta activa. Debe existir en <code className="text-[10px]">plateasEventos</code> con
            subcolección <code className="text-[10px]">asientos</code> (mismos ids que el plano). El comprador elige
            acá la platea; el precio es por platea × cantidad elegida. Los asientos tienen que estar{" "}
            <strong>disponibles</strong> (u ocasionalmente liberados) en <em>todos</em> los partidos cargados.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="precio-socio">Precio socio</Label>
            <Input
              id="precio-socio"
              inputMode="decimal"
              value={precioSocio}
              onChange={(e) => setPrecioSocio(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="precio-gen">Precio no socio</Label>
            <Input
              id="precio-gen"
              inputMode="decimal"
              value={precioGeneral}
              onChange={(e) => setPrecioGeneral(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2 max-w-[200px]">
          <Label htmlFor="moneda">Moneda (ISO)</Label>
          <Input
            id="moneda"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            placeholder="ARS"
            maxLength={8}
          />
        </div>

        <Button
          type="button"
          className="bg-crsn-orange hover:bg-crsn-orange-hover font-headline"
          disabled={saving}
          onClick={() => void guardar()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar configuración"}
        </Button>
      </CardContent>
    </Card>
  );
}
