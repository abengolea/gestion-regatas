import type { Subcomision, SubcomisionModuleKey } from "@/lib/types";

export type { SubcomisionModuleKey } from "@/lib/types";

/**
 * Si el flag no existe o no es `false`, el módulo queda habilitado (compatibilidad con datos previos).
 * Incluye `ventaEntradas`: visible por defecto; el gerente puede desactivarlo en Funcionalidades.
 */
export function isSubcomisionModuleEnabled(
  flags: Subcomision["moduleFlags"] | undefined,
  key: SubcomisionModuleKey
): boolean {
  return flags?.[key] !== false;
}

export const SUBCOMISION_MODULE_DEFINITIONS: {
  key: SubcomisionModuleKey;
  label: string;
  description: string;
}[] = [
  {
    key: "attendance",
    label: "Asistencia",
    description: "Planilla por entrenamiento e historial en la ficha del jugador.",
  },
  {
    key: "trainingSchedules",
    label: "Entrenamientos",
    description: "Horarios y configuración de turnos.",
  },
  {
    key: "medicalRecords",
    label: "Fichas médicas",
    description: "Bandeja de fichas y bloque de ficha médica en el resumen del jugador.",
  },
  {
    key: "registrations",
    label: "Solicitudes de alta",
    description: "Inscripciones y solicitudes pendientes.",
  },
  {
    key: "support",
    label: "Centro de soporte",
    description: "Tickets y ayuda para staff y jugadores.",
  },
  {
    key: "notas",
    label: "Notas",
    description: "Publicaciones institucionales de la subcomisión.",
  },
  {
    key: "payments",
    label: "Pagos",
    description: "Cobranzas, cuotas y estado de pago en fichas.",
  },
  {
    key: "viajes",
    label: "Viajes",
    description: "Viajes, pagos y documentación.",
  },
  {
    key: "ventaEntradas",
    label: "Venta de entradas (plateas)",
    description: "Plano interactivo, cobro online con Mercado Pago y gestión por partido.",
  },
  {
    key: "messages",
    label: "Mensajes",
    description: "Mensajería interna (admin subcomisión).",
  },
  {
    key: "evaluations",
    label: "Evaluaciones deportivas",
    description: "Pestaña de evaluaciones en la ficha del jugador.",
  },
  {
    key: "physicalEvaluations",
    label: "Evaluaciones físicas",
    description: "Tests físicos, plantilla en ficha y menú de entrenadores.",
  },
  {
    key: "videoteca",
    label: "Videoteca",
    description: "Videos por jugador y grabación desde el panel.",
  },
  {
    key: "analytics",
    label: "Análisis IA (ficha)",
    description: "Pestaña de analíticas en la ficha (staff).",
  },
  {
    key: "recordVideo",
    label: "Grabar / subir video",
    description: "Pantalla dedicada para cargar videos (además de la videoteca en ficha).",
  },
];
