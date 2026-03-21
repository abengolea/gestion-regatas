/**
 * Extensión Tailwind para CRSN
 * Fusinar con tailwind.config.ts existente al migrar
 *
 * Reemplaza fontFamily y agrega colores CRSN específicos
 */

import type { Config } from 'tailwindcss';

export const crsnThemeExtension = {
  fontFamily: {
    body: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
    headline: ['Playfair Display', 'Georgia', 'serif'],
    code: ['Source Code Pro', 'monospace'],
  },
  colors: {
    crsn: {
      navy: {
        deep: 'hsl(var(--crsn-navy-deep))',
        medium: 'hsl(var(--crsn-navy-medium))',
        footer: 'hsl(var(--crsn-navy-footer))',
      },
      gold: 'hsl(var(--crsn-gold))',
      cream: {
        soft: 'hsl(var(--crsn-cream-soft))',
        medium: 'hsl(var(--crsn-cream-medium))',
      },
    },
  },
  letterSpacing: {
    'crsn-eyebrow': '0.15em',
    'crsn-meta': '0.08em',
  },
} satisfies Partial<Config['theme']>;
