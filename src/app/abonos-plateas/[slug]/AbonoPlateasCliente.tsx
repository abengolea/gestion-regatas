"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EscudoCRSN } from "@/components/icons/EscudoCRSN";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CampañaPublica = {
  slug: string;
  subcomisionNombre: string;
  titulo: string;
  descripcion: string;
  precioSocio: number;
  precioGeneral: number;
  moneda: string;
};

export function AbonoPlateasCliente({ slug }: { slug: string }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CampañaPublica | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"socio" | "general">("socio");
  const [email, setEmail] = useState("");
  const [nombreApellido, setNombreApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dni, setDni] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setErrorHint(null);
      try {
        const res = await fetch(`/api/abonos/publica?slug=${encodeURIComponent(slug)}`);
        const json = (await res.json()) as CampañaPublica & { error?: string; hint?: string };
        if (!res.ok) {
          if (!cancelled) {
            setError(json.error ?? "No disponible");
            setErrorHint(json.hint ?? null);
          }
          return;
        }
        if (!cancelled) setData(json as CampañaPublica);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
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
        description: "Si Mercado Pago aprobó la operación, te llegará la confirmación por mail. Conservá el comprobante.",
      });
    } else if (pago === "error") {
      toast({ variant: "destructive", title: "Pago no completado", description: "Podés reintentar cuando quieras." });
    } else if (pago === "pendiente") {
      toast({
        title: "Pago pendiente",
        description: "Mercado Pago está procesando el pago. Te avisaremos cuando se acredite.",
      });
    }
  }, [searchParams, toast]);

  const monto = data ? (tier === "socio" ? data.precioSocio : data.precioGeneral) : 0;

  const pagar = async () => {
    if (!data) return;
    setPayLoading(true);
    try {
      const res = await fetch("/api/abonos/iniciar-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          tier,
          email: email.trim(),
          nombreApellido: nombreApellido.trim(),
          telefono: telefono.trim() || undefined,
          dni: dni.trim() || undefined,
        }),
      });
      const out = (await res.json()) as { init_point?: string; error?: string };
      if (!res.ok) {
        toast({ variant: "destructive", title: "No se pudo continuar", description: out.error ?? res.statusText });
        return;
      }
      if (out.init_point) {
        window.location.href = out.init_point;
      }
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F6F8] text-[#1A1A2E]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3 px-4 py-4">
          <EscudoCRSN size={40} className="shrink-0" />
          <div className="text-left">
            <p className="font-headline text-lg font-bold uppercase tracking-tight text-[#1A1A2E]">
              Regatas<span className="text-crsn-orange">+</span>
            </p>
            <p className="text-xs text-[#1A1A2E]/75">Club de Regatas San Nicolás — abonos plateas</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {loading ? (
          <Card>
            <CardContent className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-crsn-navy" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">No disponible</CardTitle>
              <CardDescription className="space-y-2">
                <span className="block">{error}</span>
                {errorHint ? (
                  <span className="block text-xs leading-relaxed text-[#1A1A2E]/75">{errorHint}</span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" asChild>
                <Link href="/">Ir al inicio</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : data ? (
          <Card className="border-crsn-navy/10 shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#1A1A2E]/70">
                <Lock className="h-3.5 w-3.5" />
                Pago seguro con Mercado Pago
              </div>
              <CardTitle className="font-headline text-xl text-[#1A1A2E] sm:text-2xl">{data.titulo}</CardTitle>
              <CardDescription className="text-[#1A1A2E]/80">{data.subcomisionNombre}</CardDescription>
              {data.descripcion ? (
                <p className="text-sm text-[#1A1A2E]/75 pt-1">{data.descripcion}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nom">Nombre y apellido</Label>
                <Input
                  id="nom"
                  value={nombreApellido}
                  onChange={(e) => setNombreApellido(e.target.value)}
                  autoComplete="name"
                  placeholder="Como figura en el DNI"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mail">Email</Label>
                <Input
                  id="mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Para enviarte la confirmación"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tel">Teléfono (opcional)</Label>
                  <Input id="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI (opcional)</Label>
                  <Input id="dni" value={dni} onChange={(e) => setDni(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoría de precio</Label>
                <RadioGroup value={tier} onValueChange={(v) => setTier(v as "socio" | "general")}>
                  <div className="flex items-center space-x-2 rounded-md border p-3">
                    <RadioGroupItem value="socio" id="t-soc" />
                    <Label htmlFor="t-soc" className="flex-1 cursor-pointer font-normal">
                      Socio —{" "}
                      <span className="font-semibold text-[#1A1A2E]">
                        {data.moneda} {data.precioSocio.toLocaleString("es-AR")}
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border p-3">
                    <RadioGroupItem value="general" id="t-gen" />
                    <Label htmlFor="t-gen" className="flex-1 cursor-pointer font-normal">
                      No socio —{" "}
                      <span className="font-semibold text-[#1A1A2E]">
                        {data.moneda} {data.precioGeneral.toLocaleString("es-AR")}
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-[#1A1A2E]/70">
                  La verificación de membresía activa puede pedirse después; por ahora elegís la tarifa que corresponda.
                </p>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-center font-headline text-sm text-[#1A1A2E]">
                Total a pagar:{" "}
                <span className="text-lg font-bold text-crsn-orange">
                  {data.moneda} {monto.toLocaleString("es-AR")}
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                className="w-full bg-crsn-orange text-white hover:bg-crsn-orange-hover hover:text-white font-headline"
                size="lg"
                disabled={payLoading || !nombreApellido.trim() || !email.trim() || monto <= 0}
                onClick={() => void pagar()}
              >
                {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar al pago"}
              </Button>
              <p className="text-center text-xs text-[#1A1A2E]/70">
                Al continuar serás redirigido a Mercado Pago. No compartimos datos de tu tarjeta con el club.
              </p>
            </CardFooter>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
