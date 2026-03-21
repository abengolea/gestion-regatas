"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import {
  Sailboat,
  Anchor,
  Goal,
  Volleyball,
  Circle,
  Waves,
  Dumbbell,
  ArrowRight,
  QrCode,
} from "lucide-react";
import { EscudoCRSN } from "@/components/icons/EscudoCRSN";

const DEPORTES = [
  { nombre: "Remo", slug: "remo", Icono: Sailboat },
  { nombre: "Básquet", slug: "basquet", Icono: Dumbbell },
  { nombre: "Fútbol", slug: "futbol", Icono: Goal },
  { nombre: "Vóley", slug: "voley", Icono: Volleyball },
  { nombre: "Tenis", slug: "tenis", Icono: Circle },
  { nombre: "Natación", slug: "natacion", Icono: Waves },
  { nombre: "Hockey", slug: "hockey", Icono: Circle },
  { nombre: "Atletismo", slug: "atletismo", Icono: Dumbbell },
];

const NOTICIAS_MOCK = [
  { id: "1", titulo: "Novedad destacada del club", fecha: "18 Mar 2025", imagen: "https://picsum.photos/seed/crsn1/600/450" },
  { id: "2", titulo: "Resultados del torneo de remo", fecha: "17 Mar 2025", imagen: "https://picsum.photos/seed/crsn2/600/450" },
  { id: "3", titulo: "Nueva sede Arco Iris inaugurada", fecha: "16 Mar 2025", imagen: "https://picsum.photos/seed/crsn3/600/450" },
];

import { RegatasPlusHomeSection } from "@/components/regatas/RegatasPlusHomeSection";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden">
      {/* Navbar sticky */}
      <header className="crsn-navbar fixed top-0 left-0 right-0 z-50 px-4 lg:px-6 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <EscudoCRSN size={40} className="rounded-full ring-2 ring-white/30" />
          <div className="hidden sm:block">
            <span className="font-headline text-white text-lg font-bold uppercase tracking-tight">Club de Regatas</span>
            <span className="font-headline text-crsn-orange text-base block -mt-0.5 font-bold">San Nicolás</span>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-4 lg:gap-6">
          <Link href="/" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Inicio</Link>
          <Link href="/deportes" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Deportes</Link>
          <Link href="/notas" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Noticias</Link>
          <Link href="/regatas-plus" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Regatas+</Link>
          <Link href="/tienda" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Tienda</Link>
          <Link href="/socios" className="text-white/90 hover:text-white text-sm font-subhead font-medium">Socios</Link>
          <Button asChild size="sm" className="bg-crsn-orange hover:bg-crsn-orange-hover text-white font-semibold">
            <Link href="/auth/login">Mi cuenta</Link>
          </Button>
        </nav>
      </header>

      {/* Hero con imagen de fondo + overlay 60% */}
      <section className="relative pt-16 min-h-[90vh] flex items-center bg-crsn-navy">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-rio-parana.jpg"
            alt="Club de Regatas San Nicolás — Río Paraná"
            fill
            className="object-cover"
            priority
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 crsn-hero-overlay" />
        </div>
        <div className="relative container px-4 md:px-6 py-24 lg:py-32">
          <div className="max-w-3xl flex flex-col md:flex-row md:items-start gap-6">
            <EscudoCRSN size={80} className="md:mt-2 shrink-0" />
            <div>
            <h1 className="font-headline text-4xl md:text-6xl lg:text-7xl text-white font-extrabold uppercase tracking-tight leading-none">
              Club de Regatas San Nicolás
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-white/95 font-subhead font-semibold">
              Desde 1905 — Deportes, comunidad y tradición
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-crsn-orange hover:bg-crsn-orange-hover text-white font-bold px-8"
              >
                <Link href="/auth/registro">Asociate</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white/10 font-semibold"
              >
                <Link href="/auth/login">Sede Virtual</Link>
              </Button>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Últimas Novedades */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="flex justify-between items-end mb-10">
            <h2 className="font-headline text-3xl md:text-4xl text-crsn-text-dark font-bold uppercase">
              Últimas novedades
            </h2>
            <Link
              href="/notas"
              className="text-crsn-orange hover:text-crsn-orange-hover font-semibold text-sm flex items-center gap-1"
            >
              Ver todas las noticias <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {NOTICIAS_MOCK.map((nota) => (
              <Link key={nota.id} href={`/notas/${nota.id}`} className="group block">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden relative">
                  <Image
                    src={nota.imagen}
                    alt={nota.titulo}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-crsn-orange/0 group-hover:bg-crsn-orange/20 transition-colors flex items-end justify-end p-4">
                    <ArrowRight className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <h3 className="font-headline text-lg mt-4 text-crsn-text-dark font-bold uppercase group-hover:text-crsn-orange transition-colors">
                  {nota.titulo}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{nota.fecha}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ¿Qué deporte querés practicar? */}
      <section className="py-16 md:py-24 bg-crsn-navy">
        <div className="container px-4 md:px-6">
          <h2 className="font-headline text-3xl md:text-4xl text-crsn-orange font-bold uppercase text-center mb-12">
            ¿Qué deporte querés practicar?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {DEPORTES.map(({ nombre, slug, Icono }) => (
              <Link
                key={slug}
                href={`/deportes/${slug}`}
                className="group flex flex-col items-center p-6 rounded-lg bg-crsn-navy-light/50 hover:bg-crsn-navy-light border border-white/10 hover:border-crsn-orange transition-all"
              >
                <div className="h-14 w-14 rounded-full bg-crsn-orange/20 flex items-center justify-center text-crsn-orange group-hover:bg-crsn-orange/30 transition-colors">
                  <Icono className="h-7 w-7" />
                </div>
                <span className="mt-3 text-white font-semibold text-sm uppercase text-center">{nombre}</span>
                <span className="mt-2 text-crsn-orange text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Conocé más
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sede Virtual (BRIO) */}
      <section className="py-16 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="crsn-sede-virtual-bg crsn-pattern-crosses rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="flex items-center gap-4">
              <EscudoCRSN size={64} />
              <div>
                <h2 className="font-headline text-2xl md:text-3xl text-white font-bold uppercase">
                  Sede Virtual
                </h2>
                <p className="text-white/80 text-sm mt-1">Acceso rápido a trámites y servicios</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10">
                <Link href="/formularios">Formularios</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10">
                <Link href="/auth/registro">Asociate aquí</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10">
                <Link href="/formularios/descargas">Descarga de formularios</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10">
                <Link href="/turnos-tennis">Turnos de tennis</Link>
              </Button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 rounded-lg bg-white flex items-center justify-center">
                <QrCode className="h-12 w-12 text-crsn-navy" />
              </div>
              <span className="text-white/70 text-xs">QR Sede Virtual</span>
            </div>
          </div>
        </div>
      </section>

      {/* Regatas+ — Beneficios exclusivos (datos desde Firestore) */}
      <RegatasPlusHomeSection />

      {/* Footer */}
      <footer className="crsn-footer-bg py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="grid md:grid-cols-4 gap-8 md:gap-12">
            <div>
              <Link href="/" className="inline-block mb-4">
                <EscudoCRSN size={56} />
              </Link>
              <p className="text-white font-headline font-bold">Club de Regatas San Nicolás</p>
              <p className="mt-2 text-white/70 text-sm">
                Av. Juan Manuel de Rosas 100
                <br />
                San Nicolás de los Arroyos
              </p>
              <p className="mt-3 text-white/60 text-sm">
                Sedes: Arco Iris (Rivadavia 34) | Prado Español (Ugarte 5)
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold uppercase text-sm mb-4">Navegación</h3>
              <nav className="flex flex-col gap-2">
                <Link href="/" className="text-white/70 hover:text-white text-sm">Inicio</Link>
                <Link href="/deportes" className="text-white/70 hover:text-white text-sm">Deportes</Link>
                <Link href="/notas" className="text-white/70 hover:text-white text-sm">Noticias</Link>
                <Link href="/regatas-plus" className="text-white/70 hover:text-white text-sm">Regatas+</Link>
                <Link href="/tienda" className="text-white/70 hover:text-white text-sm">Tienda</Link>
              </nav>
            </div>
            <div>
              <h3 className="text-white font-semibold uppercase text-sm mb-4">Redes</h3>
              <div className="flex gap-4">
                <Link href="#" className="text-white/70 hover:text-crsn-orange text-sm">Instagram</Link>
                <Link href="#" className="text-white/70 hover:text-crsn-orange text-sm">Facebook</Link>
                <Link href="#" className="text-white/70 hover:text-crsn-orange text-sm">YouTube</Link>
              </div>
              <div className="mt-4 h-16 w-16 rounded bg-white/10 flex items-center justify-center">
                <QrCode className="h-8 w-8 text-white/70" />
              </div>
              <p className="text-white/50 text-xs mt-2">QR App / Sede Virtual</p>
            </div>
            <div>
              <nav className="flex flex-col gap-2">
                <Link href="/privacidad" className="text-white/70 hover:text-white text-sm">Política de privacidad</Link>
                <Link href="/contacto" className="text-white/70 hover:text-white text-sm">Contacto</Link>
              </nav>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-xs">
              © {new Date().getFullYear()} Club de Regatas San Nicolás. Todos los derechos reservados.
            </p>
            <p className="text-crsn-orange/80 text-xs font-semibold">Desde 1905</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
