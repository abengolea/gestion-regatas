import { listPosts } from "@/lib/posts/server";
import { NotasFeed } from "@/components/notas/NotasFeed";
import type { Metadata } from "next";

/** Evita SSG en build (App Hosting): la query a Firestore requiere índice; así el build no falla si el índice aún está en construcción. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notas | Club de Regatas",
  description: "Noticias, actividades y comunicados del Club de Regatas",
};

const PAGE_SIZE = 12;

export default async function NotasPage() {
  const { posts, nextCursor } = await listPosts({
    status: "published",
    limit: PAGE_SIZE,
  });

  return (
    <div className="container-narrow py-6 sm:py-8 md:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-headline text-fluid-3xl font-bold tracking-tight">Notas</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base max-w-xl">
          Novedades, actividades y comunicados de todas las escuelas.
        </p>
      </div>
      <NotasFeed
        initialPosts={posts}
        initialCursor={nextCursor}
        subcomisionSlug={undefined}
      />
    </div>
  );
}
