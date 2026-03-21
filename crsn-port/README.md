# CRSN — Club de Regatas San Nicolás

Paquete portable para migrar la portada de **regatas-admin** (Escuelas River) a **gestion-regatas** (CRSN).

## Contenido

| Archivo | Uso |
|---------|-----|
| `globals-crsn.css` | Tokens CSS — copiar contenido a `src/app/globals.css` |
| `tailwind.config.crsn.ts` | Config Tailwind — reemplazar `tailwind.config.ts` |
| `page-crsn.tsx` | Portada — copiar a `src/app/page.tsx` |
| `layout-crsn.tsx` | Layout — fusionar metadata y fonts en `src/app/layout.tsx` |
| `tailwind-crsn.ts` | Solo extensión (opcional) — para merge parcial |
| `MIGRATION.md` | Guía paso a paso completa |

## Workflow

1. Copiar/clonar regatas-admin → gestion-regatas
2. Seguir `MIGRATION.md` para aplicar los archivos
3. Añadir logo CRSN e imágenes en `public/`
4. Ajustar Firebase, `.env` y rutas

## Paleta CRSN

- **Azul marino** `#0a1f44` / `#0d2a5e` — fondos oscuros
- **Dorado** `#c9a84c` — acentos, CTAs
- **Crema** `#f8f7f4` / `#f0ede6` — fondos claros
- **Blanco** `#ffffff` — texto sobre oscuro, cards

## Tipografía

- **Títulos:** Playfair Display (serif)
- **Cuerpo:** DM Sans (sans-serif)
