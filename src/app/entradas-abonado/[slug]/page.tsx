import { Suspense } from "react";
import type { Metadata } from "next";
import { EntradasAbonadoCliente } from "./EntradasAbonadoCliente";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const label = decodeURIComponent(slug);
  return {
    title: `Mis plateas — ${label}`,
    description: "Abonados: liberá o retomá tu lugar por partido o pagá entrada con Mercado Pago.",
  };
}

export default async function EntradasAbonadoPage(props: PageProps) {
  const { slug } = await props.params;
  const decoded = decodeURIComponent(slug);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F6F8]">
          <p className="text-muted-foreground font-headline">Cargando…</p>
        </div>
      }
    >
      <EntradasAbonadoCliente slug={decoded} />
    </Suspense>
  );
}
