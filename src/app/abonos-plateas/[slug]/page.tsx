import { Suspense } from "react";
import { AbonoPlateasCliente } from "./AbonoPlateasCliente";

type PageProps = { params: Promise<{ slug: string }> };

export default async function AbonoPlateasPublicPage(props: PageProps) {
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
      <AbonoPlateasCliente slug={decoded} />
    </Suspense>
  );
}
