import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Sailboat, Anchor, Goal, Circle, Dumbbell } from "lucide-react";

/* ============================================
   CRSN — Portada Club de Regatas San Nicolás
   Reemplazar src/app/page.tsx con este archivo
   ============================================ */

const DEPORTES = [
  { nombre: "Remo", Icono: Sailboat },
  { nombre: "Náutica", Icono: Anchor },
  { nombre: "Fútbol", Icono: Goal },
  { nombre: "Hockey", Icono: Circle },
  { nombre: "Básquet", Icono: Dumbbell },
];

const NOTICIAS_MOCK = [
  {
    id: "1",
    tag: "Regatas",
    titulo: "Título de la nota destacada principal con varias líneas",
    fecha: "18 Mar 2025",
    imagen: "/images/crsn-nota-1.jpg",
    destacada: true,
  },
  {
    id: "2",
    tag: "Deportes",
    titulo: "Segunda nota del grid",
    fecha: "17 Mar 2025",
    imagen: "/images/crsn-nota-2.jpg",
  },
  {
    id: "3",
    tag: "Socios",
    titulo: "Tercera nota del grid",
    fecha: "16 Mar 2025",
    imagen: "/images/crsn-nota-3.jpg",
  },
];

export default function CRSNLandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background overflow-x-hidden">
      {/* 1. Navbar fija */}
      <header className="crsn-navbar fixed top-0 left-0 right-0 z-50 px-4 lg:px-6 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {/* Logo: escudo circular blanco — reemplazar con logo CRSN real */}
          <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center">
            <span className="text-crsn-navy-deep font-headline text-lg font-bold">CRSN</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-headline text-white text-lg">Club de Regatas</span>
            <span className="font-headline text-crsn-gold text-lg block -mt-0.5">San Nicolás · Est. 1892</span>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-6">
          <Link href="/el-club" className="text-white/90 hover:text-white text-sm transition-colors">El club</Link>
          <Link href="/deportes" className="text-white/90 hover:text-white text-sm transition-colors">Deportes</Link>
          <Link href="/notas" className="text-white/90 hover:text-white text-sm transition-colors">Noticias</Link>
          <Link href="/socios" className="text-white/90 hover:text-white text-sm transition-colors">Socios</Link>
          <Link href="/regatas-plus" className="text-white/90 hover:text-white text-sm transition-colors">Regatas+</Link>
          <Button asChild size="sm" className="bg-crsn-gold hover:bg-crsn-gold/90 text-crsn-navy-deep font-medium">
            <Link href="/auth/login">Área socios</Link>
          </Button>
        </nav>
      </header>

      {/* 2. Hero principal */}
      <section className="relative pt-16 min-h-[85vh] crsn-hero-bg crsn-hero-stripe flex items-center">
        <div className="container px-4 md:px-6 py-20 lg:py-28">
          <div className="max-w-2xl">
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl text-white font-normal leading-tight">
              Más de 130 años en la ribera
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/90 font-body max-w-xl">
              El Club de Regatas San Nicolás es una institución centenaria dedicada al deporte, la náutica y la comunidad. Remo, fútbol, hockey, básquet y más en un solo lugar.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button asChild size="lg" className="bg-crsn-gold hover:bg-crsn-gold/90 text-crsn-navy-deep font-medium">
                <Link href="/auth/registro">Asociate</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10">
                <Link href="/el-club">Conocé el club</Link>
              </Button>
            </div>
          </div>
          <p className="absolute bottom-8 right-4 md:right-8 text-white/70 text-xs tracking-crsn-meta uppercase">
            Fundado el 22 de octubre de 1892
          </p>
        </div>
      </section>

      {/* 3. Barra de estadísticas */}
      <section className="crsn-stats-bar py-8">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="font-headline text-4xl md:text-5xl text-crsn-navy-deep">1892</p>
              <p className="text-sm uppercase tracking-crsn-eyebrow text-crsn-navy-deep/80 mt-1 font-medium">Año fundación</p>
            </div>
            <div>
              <p className="font-headline text-4xl md:text-5xl text-crsn-navy-deep">+2.500</p>
              <p className="text-sm uppercase tracking-crsn-eyebrow text-crsn-navy-deep/80 mt-1 font-medium">Socios activos</p>
            </div>
            <div>
              <p className="font-headline text-4xl md:text-5xl text-crsn-navy-deep">12+</p>
              <p className="text-sm uppercase tracking-crsn-eyebrow text-crsn-navy-deep/80 mt-1 font-medium">Disciplinas</p>
            </div>
            <div>
              <p className="font-headline text-4xl md:text-5xl text-crsn-navy-deep">2</p>
              <p className="text-sm uppercase tracking-crsn-eyebrow text-crsn-navy-deep/80 mt-1 font-medium">Sedes</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Últimas noticias */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container px-4 md:px-6">
          <div className="flex justify-between items-end mb-8">
            <h2 className="font-headline text-3xl md:text-4xl text-foreground">Últimas noticias</h2>
            <Link href="/notas" className="text-crsn-gold hover:underline font-medium text-sm">
              Ver todas →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Nota destacada (2/3) */}
            <article className="md:col-span-2 group">
              <Link href={`/notas/${NOTICIAS_MOCK[0].id}`} className="block">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                  <Image
                    src={NOTICIAS_MOCK[0].imagen}
                    alt={NOTICIAS_MOCK[0].titulo}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/800x450/0d2a5e/c9a84c?text=CRSN";
                    }}
                  />
                  <span className="absolute top-3 left-3 bg-crsn-gold text-crsn-navy-deep text-xs font-medium uppercase tracking-wide px-2 py-1 rounded">
                    {NOTICIAS_MOCK[0].tag}
                  </span>
                </div>
                <h3 className="font-headline text-xl md:text-2xl mt-4 text-foreground group-hover:text-crsn-gold transition-colors">
                  {NOTICIAS_MOCK[0].titulo}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">{NOTICIAS_MOCK[0].fecha}</p>
              </Link>
            </article>
            {/* Notas secundarias (1/3 cada una) */}
            {NOTICIAS_MOCK.slice(1).map((nota) => (
              <article key={nota.id} className="group">
                <Link href={`/notas/${nota.id}`} className="block">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                    <Image
                      src={nota.imagen}
                      alt={nota.titulo}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/400x225/0d2a5e/c9a84c?text=CRSN";
                      }}
                    />
                    <span className="absolute top-3 left-3 bg-crsn-gold text-crsn-navy-deep text-xs font-medium uppercase tracking-wide px-2 py-1 rounded">
                      {nota.tag}
                    </span>
                  </div>
                  <h3 className="font-headline text-lg mt-4 text-foreground group-hover:text-crsn-gold transition-colors">
                    {nota.titulo}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">{nota.fecha}</p>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Nuestros deportes */}
      <section className="py-16 md:py-24 bg-crsn-navy-deep">
        <div className="container px-4 md:px-6">
          <h2 className="font-headline text-3xl md:text-4xl text-white text-center mb-12">Nuestros deportes</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
            {DEPORTES.map(({ nombre, Icono }) => (
              <Link
                key={nombre}
                href={`/deportes/${nombre.toLowerCase()}`}
                className="group flex flex-col items-center p-6 rounded-lg border-2 border-transparent hover:border-crsn-gold transition-colors"
              >
                <div className="h-16 w-16 rounded-full bg-crsn-gold/20 flex items-center justify-center text-crsn-gold group-hover:bg-crsn-gold/30 transition-colors">
                  <Icono className="h-8 w-8" />
                </div>
                <span className="mt-4 text-white font-medium uppercase tracking-crsn-eyebrow text-sm">
                  {nombre}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Banner Regatas+ */}
      <section className="crsn-banner-regatas py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="max-w-2xl">
            <h2 className="font-headline text-2xl md:text-3xl text-foreground">Regatas+</h2>
            <p className="mt-4 text-muted-foreground">
              Programa de beneficios exclusivos para socios. Descuentos en comercios adheridos, acceso a eventos y mucho más.
            </p>
            <Button asChild size="lg" className="mt-6 bg-crsn-gold hover:bg-crsn-gold/90 text-crsn-navy-deep font-medium">
              <Link href="/regatas-plus">Ver beneficios</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="crsn-footer-bg py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div>
              <h3 className="font-headline text-white text-lg">Club de Regatas San Nicolás</h3>
              <p className="mt-2 text-white/70 text-sm">
                Av. de la Ribera s/n, San Nicolás de los Arroyos
              </p>
              <Link href="https://crsn.com.ar" className="text-crsn-gold hover:underline text-sm mt-2 inline-block">
                crsn.com.ar
              </Link>
            </div>
            <div>
              <h3 className="text-white font-medium text-sm uppercase tracking-crsn-eyebrow mb-4">El club</h3>
              <nav className="flex flex-col gap-2">
                <Link href="/el-club" className="text-white/70 hover:text-white text-sm">Historia</Link>
                <Link href="/deportes" className="text-white/70 hover:text-white text-sm">Deportes</Link>
                <Link href="/notas" className="text-white/70 hover:text-white text-sm">Noticias</Link>
              </nav>
            </div>
            <div>
              <h3 className="text-white font-medium text-sm uppercase tracking-crsn-eyebrow mb-4">Socios</h3>
              <nav className="flex flex-col gap-2">
                <Link href="/auth/login" className="text-white/70 hover:text-white text-sm">Área socios</Link>
                <Link href="/regatas-plus" className="text-white/70 hover:text-white text-sm">Regatas+</Link>
                <Link href="/auth/registro" className="text-white/70 hover:text-white text-sm">Asociate</Link>
              </nav>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-xs">
              © {new Date().getFullYear()} Club de Regatas San Nicolás. Todos los derechos reservados.
            </p>
            <p className="text-crsn-gold/80 text-xs tracking-crsn-meta">Est. 1892</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
