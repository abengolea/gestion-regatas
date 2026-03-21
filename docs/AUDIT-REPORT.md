# Auditoría de Calidad — Club de Regatas San Nicolás (CRSN)

**Fecha:** 2025  
**Ámbito:** Landing, Auth, Design System  
**Referencia:** Design Context en CLAUDE.md + skills audit, frontend-design

---

## Anti-Patterns Verdict

**Resultado: APROBADO con observaciones menores.**

El sitio tiene identidad institucional propia (azul marino + naranja, Barlow Condensed, patrón de cruces). No presenta los patrones típicos de AI slop:

- ✅ Paleta específica del club (no cyan-on-dark, ni purple gradients)
- ✅ Tipografía distintiva (Barlow, no Inter genérico)
- ✅ Sin hero metrics genéricos (número grande + label)
- ✅ Sin glassmorphism
- ✅ Sin gradient text
- ⚠️ Grid de cards repetitivo en noticias y deportes — estructura común pero con contenido diferenciado
- ⚠️ Algunos links sin `aria-label` descriptivo

---

## Executive Summary

| Métrica | Valor |
|--------|-------|
| **Total de hallazgos** | 18 |
| **Críticos** | 1 |
| **Altos** | 4 |
| **Medios** | 7 |
| **Bajos** | 6 |
| **Calificación estimada** | 7.5/10 |

**Prioridad inmediata:**
1. Touch targets < 44px en móvil (WCAG 2.5.5)
2. Nav y footer sin `aria-label` para lectores de pantalla
3. Imágenes con `alt=""` en componentes compartidos (NotaForm, PostCard)

**Próximos pasos recomendados:**
- Ejecutar `/harden` para edge cases y i18n
- Ejecutar `/adapt` para revisar responsive y touch targets
- Ejecutar `/normalize` para tokens y consistencia

---

## Detailed Findings by Severity

### Critical Issues

| # | Ubicación | Categoría | Descripción | Impacto | Recomendación |
|---|-----------|-----------|-------------|---------|---------------|
| 1 | `src/app/auth/login/page.tsx` — botón Shield | A11y | Botón `h-8 w-8` (32×32px) — por debajo del mínimo WCAG 2.5.5 (44×44px) para touch targets | Usuarios móviles con dificultad para tocar el ícono | Aumentar a `min-h-[44px] min-w-[44px]` o `h-10 w-10` con padding |

---

### High-Severity Issues

| # | Ubicación | Categoría | Descripción | Impacto | Recomendación |
|---|-----------|-----------|-------------|---------|---------------|
| 2 | `src/app/page.tsx` — `<nav>` líneas 57–66 | A11y | Nav principal sin `aria-label="Navegación principal"` | Lectores de pantalla no identifican la navegación | Agregar `aria-label` al nav |
| 3 | `src/app/page.tsx` — footer nav | A11y | Enlaces del footer sin `aria-label` descriptivo | Contexto perdido en navegación por teclado | Añadir `aria-label` donde el texto del link sea ambiguo |
| 4 | `src/components/notas/PostCard.tsx` | A11y | `<Image alt="" />` — imagen sin descripción | Usuarios con lectores de pantalla no reciben información | Usar `alt={post.title}` o descripción equivalente |
| 5 | `src/app/escuelas/[schoolSlug]/notas/[postSlug]/page.tsx` | A11y | Imagen principal con `alt=""` | Contenido visual no anunciado | Asignar `alt` descriptivo según título o contenido |

---

### Medium-Severity Issues

| # | Ubicación | Categoría | Descripción | Impacto | Recomendación |
|---|-----------|-----------|-------------|---------|---------------|
| 6 | `src/app/auth/layout.tsx` L.10 | Theming | Color hardcodeado `#1B2A5E08` en gradiente | Inconsistencia si cambia la paleta | Usar variable `hsl(var(--crsn-navy) / 0.03)` |
| 7 | `src/app/globals.css` L.84, 91 | Theming | Hex y rgba en SVG de patrón de cruces | No usa design tokens | Referenciar variables CSS donde sea posible |
| 8 | `src/components/ui/select.tsx` | A11y | Usa `focus:` en lugar de `focus-visible:` | Focus visible en clic (mouse) cuando no es necesario | Cambiar a `focus-visible:` para consistencia |
| 9 | `src/app/page.tsx` — links navbar | Responsive | Links sin `min-h` para touch targets | Área tocable puede ser < 44px en móvil | Añadir `py-3` o `min-h-[44px]` a los links |
| 10 | `src/components/notas/NotaForm.tsx` L.250 | A11y | `<img alt="" />` en preview de portada | Imagen sin descripción para lectores de pantalla | Usar `alt="Vista previa de portada"` o similar |
| 11 | `src/components/icons/AppLogo.tsx` | Theming/Brand | `alt="Escuelas River Logo"` — branding obsoleto | Inconsistencia con CRSN | Actualizar a "Logo Club de Regatas San Nicolás" |
| 12 | `src/app/page.tsx` — hero Image | Performance | Imagen hero local que puede 404 | Fallback solo oculta la imagen; sigue intentando cargar | Usar placeholder o validar existencia del asset |

---

### Low-Severity Issues

| # | Ubicación | Categoría | Descripción | Impacto | Recomendación |
|---|-----------|-----------|-------------|---------|---------------|
| 13 | `src/app/page.tsx` — NOTICIAS_MOCK, COMERCIOS | Theming | URLs placehold.co con hex hardcodeados | Menor — placeholders temporales | Documentar o extraer a constantes cuando se conecte CMS |
| 14 | Landing footer — redes sociales | A11y | Links "Instagram", "Facebook" sin `aria-label` | Redundante si el texto ya es descriptivo | Evaluar si hace falta; en iconos sí usar `aria-label` |
| 15 | Botón "Mi cuenta" en navbar | A11y | Depende de contexto visual | Puede ser ambiguo en algunos contextos | Considerar `aria-label="Acceder a Mi cuenta"` si se usa solo ícono en mobile |
| 16 | Cards deportes — Tenis/Hockey, Básquet/Atletismo | UX | Mismo ícono (Circle, Dumbbell) para deportes distintos | Menor confusión visual | Diferenciar íconos cuando lucide lo permita |
| 17 | `src/app/page.tsx` — onError en Image | Código | `onError` modifica DOM directamente | Puede no funcionar igual en todas las versiones de Next Image | Revisar comportamiento con Next.js 15 |
| 18 | Dark mode en globals.css | Theming | Tema dark definido pero CRSN es solo light | Código muerto si no se usa dark | Documentar o eliminar si no hay plan de dark mode |

---

## Patterns & Systemic Issues

1. **`aria-label` en navegación**: Los elementos `<nav>` y varios enlaces no tienen `aria-label`; conviene unificar el criterio en layout, footer y menús.
2. **Touch targets**: Varios elementos interactivos (links, botón Shield) están por debajo de 44×44px recomendados en móvil.
3. **Tokens vs. valores fijos**: Hay hex y rgba en layout y CSS que no usan variables CRSN.
4. **Alt de imágenes**: Algunos componentes comparten el patrón `alt=""` en imágenes de contenido.

---

## Positive Findings

- ✅ Design tokens bien definidos en `globals.css` (crsn-navy, crsn-orange, etc.)
- ✅ Formularios de login y registro con labels asociados correctamente
- ✅ Componentes UI base (Button, Input, etc.) con `focus-visible:ring`
- ✅ Uso de `overflow-x-hidden` para evitar scroll horizontal
- ✅ Breakpoints coherentes (sm, md, lg) en la landing
- ✅ Identidad visual consistente (azul marino + naranja)
- ✅ Tipografía Barlow alineada con la especificación del club

---

## Recommendations by Priority

### Inmediato
1. Aumentar touch target del botón Shield (login) a ≥ 44×44px.
2. Añadir `aria-label` al nav principal de la landing.
3. Corregir `alt` en PostCard y página de nota individual.

### Corto plazo
4. Reemplazar colores hardcodeados por variables en auth layout y globals.
5. Unificar `focus` vs `focus-visible` en Select.
6. Asegurar touch targets mínimos en links del navbar (mobile).

### Mediano plazo
7. Actualizar branding en AppLogo (River → CRSN).
8. Revisar hero image (placeholder o validación de asset).
9. Documentar o eliminar dark mode si no se usa.

### Largo plazo
10. Diferenciar íconos de deportes cuando haya alternativas en lucide.
11. Evaluar `prefers-reduced-motion` para animaciones.

---

## Suggested Commands for Fixes

| Comando | Área | Hallazgos que aborda |
|---------|------|---------------------|
| `/adapt` | Responsive, touch targets | #1, #9 |
| `/harden` | Edge cases, i18n, errores | #12, #17 |
| `/normalize` | Tokens, consistencia | #6, #7, #13, #11 |
| `/polish` | Alineación, espaciado, detalle | Varios de bajo impacto |
| `/clarify` | UX copy, mensajes de error | Labels, alt text |

---

*Auditoría generada siguiendo las guías de los skills `audit` y `frontend-design`.*
