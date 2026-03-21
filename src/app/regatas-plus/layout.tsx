import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EscudoCRSN } from '@/components/icons/EscudoCRSN';

export const metadata: Metadata = {
  title: 'Regatas+ — Beneficios para socios | Club de Regatas San Nicolás',
  description: 'Programa de beneficios exclusivos para socios. Descuentos en comercios adheridos de San Nicolás.',
};

export default function RegatasPlusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="crsn-navbar sticky top-0 z-50 px-4 lg:px-6 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <EscudoCRSN size={40} className="rounded-full ring-2 ring-white/30" />
          <div className="hidden sm:block">
            <span className="font-headline text-white text-lg font-bold uppercase tracking-tight">
              Club de Regatas
            </span>
            <span className="font-headline text-crsn-orange text-base block -mt-0.5 font-bold">
              San Nicolás
            </span>
          </div>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/"
            className="text-white/90 hover:text-white text-sm font-subhead font-medium"
          >
            Inicio
          </Link>
          <Link
            href="/regatas-plus"
            className="text-crsn-orange font-semibold text-sm"
          >
            Regatas+
          </Link>
          <Button asChild size="sm" className="bg-crsn-orange hover:bg-crsn-orange-hover text-white font-semibold">
            <Link href="/auth/login">Mi cuenta</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
