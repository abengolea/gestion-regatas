/**
 * Tipos para el módulo de Viajes y Subcomisiones.
 * Regatas+ — Club de Regatas San Nicolás
 */

/** Compatible con Firestore Timestamp o Date (convertido al leer). */
export type ViajeTimestamp = { toDate: () => Date; seconds: number; nanoseconds: number } | Date;

export type MetodoPagoKey =
  | 'transferencia_whatsapp'
  | 'transferencia_app'
  | 'mercadopago'
  | 'santander_pay';

export type EstadoViaje = 'borrador' | 'abierto' | 'cerrado' | 'finalizado';
export type EstadoPagoViaje = 'pendiente' | 'en_revision' | 'pagado' | 'rechazado';
export type DocRequerida = 'dni' | 'aps' | 'apf' | 'autorizacion';

/** @deprecated Usar metodoPagoHabilitado. Compatibilidad. */
export type MetodoPagoViaje = 'mp' | 'transferencia' | 'ambos';

/** Categoría de viaje (ej. U21, U17). Puede tener tiras A, B, C. */
export interface CategoriaViaje {
  id: string;
  nombre: string;
  /** Subgrupos opcionales: Tira A, Tira B, Tira C */
  tiras?: string[];
  orden: number;
}

export interface Viaje {
  id: string;
  subcomisionId: string;
  destino: string;
  descripcion?: string;
  fechaSalida: ViajeTimestamp;
  fechaRegreso: ViajeTimestamp;
  precioPorJugador: number;
  /** Métodos de pago habilitados para este viaje */
  metodoPagoHabilitado?: MetodoPagoKey[];
  /** @deprecated Usar metodoPagoHabilitado */
  metodoPago?: MetodoPagoViaje;
  cbuClub?: string;
  aliasClub?: string;
  vencimientoPago: ViajeTimestamp;
  documentacionRequerida: DocRequerida[];
  estado: EstadoViaje;
  jugadoresDesignados: string[];
  /** Categorías del viaje (ej. U21, U17). Múltiples permitidas. */
  categoriaIds?: string[];
  /** Jugadores citados por categoría: categoriaId -> socioIds */
  jugadoresPorCategoria?: Record<string, string[]>;
  creadoPor: string;
  creadoEn: ViajeTimestamp;
  updatedAt: ViajeTimestamp;
}

export interface PagoViaje {
  id: string;
  viajeId: string;
  socioId: string;
  monto: number;
  metodoPago: MetodoPagoKey;
  estado: EstadoPagoViaje;
  providerPaymentId?: string;
  comprobanteUrl?: string;
  comprobanteFuente?: 'whatsapp' | 'app';
  celularPagador?: string;
  aprobadoPor?: string;
  rechazadoMotivo?: string;
  notificadoEn?: ViajeTimestamp;
  confirmadoEn?: ViajeTimestamp;
  creadoEn?: ViajeTimestamp;
  /** @deprecated Usar comprobanteUrl */
  comprobante?: string;
  mpPreferenceId?: string;
  mpPaymentId?: string;
}

export interface DocViaje {
  socioId: string;
  viajeId: string;
  dni: boolean;
  aps: boolean;
  apf: boolean;
  autorizacion: boolean;
  updatedAt: ViajeTimestamp;
}

/** Sesión de WhatsApp de Regatas+ — colección wa_sessions_regatas */
export interface WaSessionRegatas {
  phone: string;
  estado: 'esperando_dni' | 'esperando_seleccion_viaje';
  viajesDisponibles?: string[];
  imagenUrl?: string;
  expiraEn: ViajeTimestamp;
}
