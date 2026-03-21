import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Store } from 'lucide-react';
import { EscudoCRSN } from '@/components/icons/EscudoCRSN';
import { getComerciosActivos } from '@/lib/comercios';

function formatBeneficio(c: { tipoBeneficio?: string; porcentajeDescuento?: number }): string {
  if (c.porcentajeDescuento) {
    return `${c.porcentajeDescuento}% OFF`;
  }
  if (c.tipoBeneficio) {
    return c.tipoBeneficio;
  }
  return 'Beneficio especial';
}

export default async function RegatasPlusPage() {
  const comercios = await getComerciosActivos();

  return (
    <div className="container px-4 md:px-6 py-12">
      {/* Hero */}
      <section className="mb-16">
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div className="flex-1">
            <h1 className="font-headline text-4xl md:text-5xl text-crsn-text-dark font-bold uppercase tracking-tight">
              Regatas+
            </h1>
            <p className="mt-4 text-xl text-muted-foreground font-subhead">
              Beneficios exclusivos para socios del Club de Regatas San Nicolás. Descuentos reales en comercios de San Nicolás de los Arroyos.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/auth/registro"
                className="inline-flex items-center gap-2 px-6 py-3 bg-crsn-orange hover:bg-crsn-orange-hover text-white font-bold rounded-lg transition-colors"
              >
                Asociate al club <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center px-6 py-3 border-2 border-crsn-navy text-crsn-navy hover:bg-crsn-navy/5 font-semibold rounded-lg transition-colors"
              >
                Ya soy socio
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <EscudoCRSN size={160} className="text-crsn-navy" />
          </div>
        </div>
      </section>

      {/* Comercios */}
      <section>
        <h2 className="font-headline text-2xl md:text-3xl text-crsn-text-dark font-bold uppercase mb-6">
          Comercios adheridos
        </h2>
        {comercios.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              Próximamente se incorporarán nuevos comercios. Consultá en sede.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-crsn-orange hover:text-crsn-orange-hover font-semibold"
            >
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {comercios.map((c) => (
              <Link
                key={c.id}
                href={`/regatas-plus/comercios/${c.id}`}
                className="group p-4 rounded-xl border border-border hover:border-crsn-orange hover:shadow-lg transition-all"
              >
                <div className="h-20 bg-muted rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                  {c.logo ? (
                    <Image
                      src={c.logo}
                      alt={c.razonSocial}
                      width={80}
                      height={80}
                      className="object-contain w-full h-full"
                    />
                  ) : (
                    <span className="text-crsn-navy font-bold text-2xl">
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
        )}
      </section>
    </div>
  );
}
