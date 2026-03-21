# Club de Regatas San Nicolás — Contexto para Claude

## Design Context

### Users
- **Socios del club**: miembros activos que acceden a la Sede Virtual (QR Regatas+, estado de cuotas, perfil).
- **Administración**: gerentes, encargados de subcomisiones, staff deportivo.
- **Visitantes públicos**: personas que exploran el sitio institucional, buscan información de deportes, noticias y quieren asociarse.
- **Comercios adheridos**: partenaires del programa Regatas+ que validan beneficios.
- **Contexto**: club deportivo centenario (desde 1905), San Nicolás de los Arroyos. Deportes: remo, básquet, fútbol, vóley, tenis, natación, hockey, atletismo.
- **Job principal**: comunicar identidad institucional, facilitar trámites, ofrecer beneficios (Regatas+), gestionar socios y actividades.

### Brand Personality
- **3 palabras**: Institucional, deportivo, confiable.
- **Voz y tono**: profesional, cercano, sin exageraciones. Evitar lenguaje startup o genérico.
- **Objetivos emocionales**: confianza, pertenencia, claridad.
- **Anti-referencias**: no parecer template AI, no gradientes purple-cyan, no glassmorphism excesivo, no hero metrics genéricos.

### Aesthetic Direction
- **Paleta institucional** (respétala estrictamente):
  - Azul marino principal: `#1B2A5E`
  - Azul marino claro: `#243570`
  - Naranja institucional: `#E8531F` (acentos, CTAs)
  - Naranja hover: `#D4461A`
  - Blanco: `#FFFFFF`
  - Gris fondo: `#F5F6F8`
  - Texto oscuro: `#1A1A2E`
- **Tipografía**: Barlow Condensed (títulos), Barlow Semi Condensed (subtítulos), Barlow (cuerpo).
- **Estilo**: deportivo e institucional, limpio, sin sombras pesadas ni bordes gruesos. Patrón de cruces (+) sutil en fondos oscuros.
- **Solo light mode** — los colores del club son fijos.

### Design Principles
1. **Identidad consistente**: usar siempre tokens CRSN (crsn-navy, crsn-orange, etc.), nunca colores hardcodeados.
2. **Accesibilidad primero**: contraste suficiente, touch targets ≥ 44px, labels en formularios, alt en imágenes.
3. **Mobile-first**: el QR del socio se usa desde el celular; esa pantalla es prioritaria.
4. **Jerarquía clara**: naranja solo para CTAs y acentos; evitar múltiples elementos competiendo por atención.
5. **Contenido sobre decoración**: evitar elementos decorativos innecesarios; cada elemento debe tener propósito.
