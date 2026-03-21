"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { Comercio } from "@/lib/types/comercio";

function formatBeneficio(c: Comercio): string {
  if (c.porcentajeDescuento) return `${c.porcentajeDescuento}% OFF`;
  if (c.tipoBeneficio) return c.tipoBeneficio;
  return "Beneficio";
}

export function RegatasPlusHomeSection() {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/regatas-plus/comercios")
      .then((res) => res.ok ? res.json() : [])
      .then((data: Comercio[]) => {
        setComercios(Array.isArray(data) ? data : []);
      })
      .catch(() => setComercios([]))
      .finally(() => setLoading(false));
  }, []);

  const displayComercios = comercios.slice(0, 8);

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="font-headline text-3xl md:text-4xl text-crsn-text-dark font-bold uppercase">
            Regatas+ — Beneficios exclusivos para socios
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Más de 1.200 socios disfrutando de descuentos reales en comercios de San Nicolás. Gastronomía, salud, indumentaria y más.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-border animate-pulse"
              >
                <div className="h-16 bg-muted rounded-lg mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-6 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
              </div>
            ))}
          </div>
        ) : displayComercios.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {displayComercios.map((c) => (
                <Link
                  key={c.id}
                  href={`/regatas-plus/comercios/${c.id}`}
                  className="group p-4 rounded-xl border border-border hover:border-crsn-orange hover:shadow-lg transition-all"
                >
                  <div className="h-16 bg-muted rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                    {c.logo ? (
                      <Image
                        src={c.logo}
                        alt={c.razonSocial}
                        width={64}
                        height={64}
                        className="object-contain w-full h-full"
                      />
                    ) : (
                      <span className="text-crsn-navy font-bold text-lg">
                        {c.razonSocial.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-crsn-text-dark group-hover:text-crsn-orange transition-colors line-clamp-2">
                    {c.razonSocial}
                  </h3>
                  <span className="inline-block mt-2 px-2 py-1 bg-crsn-orange text-white text-xs font-bold rounded">
                    {formatBeneficio(c)}
                  </span>
                  <p className="text-muted-foreground text-xs mt-2">{c.rubro}</p>
                </Link>
              ))}
            </div>
            <div className="text-center">
              <Button
                asChild
                size="lg"
                className="bg-crsn-orange hover:bg-crsn-orange-hover text-white font-bold"
              >
                <Link href="/regatas-plus">Ver todos los comercios</Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground mb-4">
              Próximamente nuevos comercios adheridos.
            </p>
            <Button asChild size="lg" variant="outline">
              <Link href="/regatas-plus">Conocé Regatas+</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
