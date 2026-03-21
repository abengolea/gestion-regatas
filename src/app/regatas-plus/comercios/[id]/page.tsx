import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, Mail, Globe, Instagram } from 'lucide-react';
import { getComercio } from '@/lib/comercios';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comercio = await getComercio(id);
  if (!comercio) return { title: 'Comercio no encontrado' };
  return {
    title: `${comercio.razonSocial} | Regatas+`,
    description: comercio.tipoBeneficio || `${comercio.porcentajeDescuento}% descuento para socios`,
  };
}

export default async function ComercioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const comercio = await getComercio(id);

  if (!comercio) {
    notFound();
  }

  const beneficioLabel = comercio.porcentajeDescuento
    ? `${comercio.porcentajeDescuento}% de descuento`
    : comercio.tipoBeneficio || 'Beneficio especial';

  return (
    <div className="container px-4 md:px-6 py-12">
      <Link
        href="/regatas-plus"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-crsn-navy font-medium mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Regatas+
      </Link>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        <div>
          <div className="aspect-square max-w-md rounded-xl overflow-hidden bg-muted">
            {comercio.logo ? (
              <Image
                src={comercio.logo}
                alt={comercio.razonSocial}
                width={400}
                height={400}
                className="object-contain w-full h-full p-4"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl font-bold text-crsn-navy/30">
                  {comercio.razonSocial.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-crsn-orange text-white text-sm font-bold rounded mb-4">
            {beneficioLabel}
          </span>
          <h1 className="font-headline text-3xl md:text-4xl text-crsn-text-dark font-bold uppercase">
            {comercio.razonSocial}
          </h1>
          <p className="text-muted-foreground mt-2">{comercio.rubro}</p>

          {(comercio.domicilio || comercio.localidad) && (
            <div className="mt-6 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-crsn-orange shrink-0 mt-0.5" />
              <div>
                {comercio.domicilio && <p>{comercio.domicilio}</p>}
                {comercio.localidad && (
                  <p className="text-muted-foreground">{comercio.localidad}</p>
                )}
              </div>
            </div>
          )}

          {comercio.telefono && (
            <div className="mt-3 flex items-center gap-3">
              <Phone className="h-5 w-5 text-crsn-orange shrink-0" />
              <a href={`tel:${comercio.telefono}`} className="hover:text-crsn-orange">
                {comercio.telefono}
              </a>
            </div>
          )}

          {comercio.email && (
            <div className="mt-3 flex items-center gap-3">
              <Mail className="h-5 w-5 text-crsn-orange shrink-0" />
              <a href={`mailto:${comercio.email}`} className="hover:text-crsn-orange">
                {comercio.email}
              </a>
            </div>
          )}

          {comercio.web && (
            <div className="mt-3 flex items-center gap-3">
              <Globe className="h-5 w-5 text-crsn-orange shrink-0" />
              <a
                href={comercio.web.startsWith('http') ? comercio.web : `https://${comercio.web}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-crsn-orange"
              >
                {comercio.web}
              </a>
            </div>
          )}

          {comercio.instagram && (
            <div className="mt-3 flex items-center gap-3">
              <Instagram className="h-5 w-5 text-crsn-orange shrink-0" />
              <a
                href={`https://instagram.com/${comercio.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-crsn-orange"
              >
                @{comercio.instagram.replace('@', '')}
              </a>
            </div>
          )}

          {comercio.productosIncluidos && (
            <div className="mt-8 p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold text-crsn-text-dark mb-2">
                Productos/servicios incluidos
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {comercio.productosIncluidos}
              </p>
            </div>
          )}

          {comercio.condicionesEspeciales && (
            <div className="mt-4 p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-crsn-text-dark mb-2">
                Condiciones especiales
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {comercio.condicionesEspeciales}
              </p>
            </div>
          )}

          {comercio.diasHorarios && (
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Horarios:</strong> {comercio.diasHorarios}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
