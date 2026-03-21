# Prompt para Firebase Studio — Club de Regatas San Nicolás

Documento de especificación completa para el sitio CRSN. Usar en Firebase Studio u otras herramientas de desarrollo asistido.

---

## Frase para arrancar

> "Creá el nuevo sitio web del Club de Regatas San Nicolás usando Next.js 14, Tailwind CSS y Firebase. Los colores institucionales son azul marino #1B2A5E y naranja #E8531F. El sitio integra: home institucional, programa Regatas+ de beneficios para socios con QR dinámico, sede virtual (login Firebase Auth + dashboard del socio), tienda de merchandising con Mercado Pago, y sección de noticias/agenda. Usá la tipografía Barlow Condensed para títulos. El diseño debe ser moderno, deportivo e institucional, fiel al estilo del club. Comenzá por el layout base (Navbar + Footer + Home) y la estructura de carpetas del proyecto."

---

## Resumen del proyecto

El proyecto ya tiene aplicado en este repo:

- **Design tokens**: `src/app/globals.css` con colores CRSN (azul #1B2A5E, naranja #E8531F)
- **Tipografía**: Barlow Condensed (títulos), Barlow Semi Condensed (subtítulos), Barlow (cuerpo)
- **Home**: Hero, Últimas Novedades, Deportes, Sede Virtual, Regatas+, Footer
- **Stack**: Next.js 15, Tailwind, Firebase (Auth, Firestore, Storage)

Ver el archivo completo de especificación en el prompt original adjunto para:
- Arquitectura de páginas (Regatas+, Sede Virtual, Tienda, Noticias)
- Colecciones Firestore
- Roles y permisos
- Componentes clave (QRDisplay, QRScanner, CartDrawer, etc.)
- Integración Mercado Pago
