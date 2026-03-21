# Migración regatas-admin → gestion-regatas (CRSN)

Guía para transformar el código base de Escuelas River en el sitio del Club de Regatas San Nicolás.

---

## Paso 0: Preparar el repositorio gestion-regatas

```bash
# Opción A: Copiar desde regatas-admin
cd c:\Users\Adrian\Documents\mis-proyectos
git clone <url-regatas-admin> gestion-regatas
cd gestion-regatas
git remote set-url origin https://github.com/abengolea/gestion-regatas.git
git push -u origin main

# Opción B: Si gestion-regatas ya tiene un clone vacío
cd gestion-regatas
git remote add upstream <url-regatas-admin>
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

---

## Paso 1: Archivos del design system CRSN

Los archivos en `crsn-port/` deben aplicarse sobre el proyecto:

| Origen | Destino | Acción |
|--------|---------|--------|
| `crsn-port/globals-crsn.css` | `src/app/globals.css` | **Reemplazar** contenido |
| `crsn-port/page-crsn.tsx` | `src/app/page.tsx` | **Reemplazar** contenido |
| `crsn-port/layout-crsn.tsx` | `src/app/layout.tsx` | **Fusionar** (metadata, fonts) |
| `crsn-port/tailwind-crsn.ts` | `tailwind.config.ts` | **Fusionar** theme.extend |

---

## Paso 2: Ajustar tailwind.config.ts

En `tailwind.config.ts`, reemplazar el bloque `theme.extend` o fusionar con:

```ts
import { crsnThemeExtension } from './crsn-port/tailwind-crsn';

// Dentro de theme: { extend: { ...crsnThemeExtension, ... } }
```

O copiar manualmente:

- `fontFamily.body` → `['DM Sans', 'Inter', 'system-ui', 'sans-serif']`
- `fontFamily.headline` → `['Playfair Display', 'Georgia', 'serif']`
- `colors.crsn` → objeto con navy, gold, cream
- `letterSpacing['crsn-eyebrow']` → `'0.15em'`
- `letterSpacing['crsn-meta']` → `'0.08em'`

---

## Paso 3: package.json

Cambiar el nombre del proyecto:

```json
{
  "name": "gestion-regatas",
  "version": "0.1.0",
  ...
}
```

---

## Paso 4: Identidad y assets

### Eliminar / reemplazar

- [ ] `RiverPlateLogo` — crear o añadir logo CRSN en `public/logo-crsn.png`
- [ ] Imágenes hero: `/images/hero-*.jpeg` → imágenes CRSN (remo, club, etc.)
- [ ] Regla `.cursor/rules/escuelas-river.mdc` — eliminar o reemplazar por reglas CRSN

### Añadir

- [ ] Logo/escudo CRSN en `public/`
- [ ] Imágenes de noticias en `public/images/` (crsn-nota-1.jpg, etc.) o conectar a CMS
- [ ] Favicon CRSN

---

## Paso 5: Rutas y links

La portada CRSN referencia estas rutas. Crear páginas placeholder o conectar con contenido existente:

| Ruta | Descripción |
|------|-------------|
| `/el-club` | Historia e info del club |
| `/deportes` | Listado de deportes |
| `/deportes/[slug]` | Página por deporte |
| `/notas` | Listado de noticias |
| `/socios` | Info para socios |
| `/regatas-plus` | Programa de beneficios |
| `/auth/login` | Área socios (ya existe) |
| `/auth/registro` | Registro (ya existe) |

---

## Paso 6: Componentes pendientes (según brief)

1. **QR Card del socio** — en dashboard o área socios, mostrar número, nombre y QR Regatas+
2. **Banner Regatas+** — ya incluido en la portada; revisar copy y CTA
3. **Cards de subcomisiones** — pueden extenderse desde la sección "Nuestros deportes"

---

## Paso 7: Firebase y entorno

- [ ] Crear proyecto Firebase para CRSN (o reutilizar si es la misma plataforma)
- [ ] Actualizar `.env` / `.env.local` con credenciales CRSN
- [ ] Revisar reglas de Firestore y Auth para el dominio crsn.com.ar

---

## Paso 8: Testing local

```bash
cd gestion-regatas
npm install
npm run dev
```

Verificar:

- [ ] Portada carga con paleta CRSN (azul marino, dorado, crema)
- [ ] Tipografía Playfair Display + DM Sans
- [ ] Navbar fija, hero, stats, noticias, deportes, banner Regatas+, footer
- [ ] Links funcionales
- [ ] Responsive en mobile

---

## Resumen de archivos crsn-port/

```
crsn-port/
├── globals-crsn.css      # Tokens CSS CRSN
├── tailwind-crsn.ts      # Extensión Tailwind
├── page-crsn.tsx         # Portada completa
├── layout-crsn.tsx       # Layout con metadata y fonts
└── MIGRATION.md          # Esta guía
```

---

## Contacto

- Repo: https://github.com/abengolea/gestion-regatas
- Sitio: crsn.com.ar
- Stack: Next.js 15, Tailwind CSS, Firebase
