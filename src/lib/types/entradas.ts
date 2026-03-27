/**
 * Venta de plateas / entradas (ej. Básquet profesional).
 * Firestore: subcomisiones/{subId}/plateasEventos/{eventId} y subcolección asientos.
 */

export type PlateaSeatStatus =
  | 'disponible'
  | 'reservado'
  /** Reserva desde panel (sin pago MP en curso) */
  | 'reservado_manual'
  | 'pagado'
  | 'abonado_fijo'
  /** Abonado cedió el asiento para un partido puntual (entradas a la venta) */
  | 'liberado_temporal';

export type EntradaPriceTier = 'socio' | 'general';

export interface PlateasEvento {
  id: string;
  subcomisionId: string;
  /** Título para mostrar (ej. "vs Peñarol") */
  titulo: string;
  fechaPartido: string;
  /** ISO; venta habilitada hasta */
  ventaHasta?: string;
  estado: 'borrador' | 'venta_abierta' | 'cerrado';
  /** ARS */
  precioSocio: number;
  precioGeneral: number;
  moneda: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PlateaAsiento {
  id: string;
  /** Número visible en el plano (1…563 en cancha real) */
  numeroVisible: number;
  sector: 'rio' | 'barranca';
  fila?: string;
  estado: PlateaSeatStatus;
  /** Titular habitual (abonado) o comprador */
  titularNombre?: string;
  titularSocioId?: string;
  titularEmail?: string;
  titularDni?: string;
  /** Registrado al reservar desde panel */
  tierReserva?: EntradaPriceTier;
  reservadoManualEn?: Date;
  reservadoManualPorUid?: string;
  mpPaymentId?: string;
  pagoConfirmadoEn?: Date;
  /** Si el abonado liberó para este evento */
  liberadoEnEventoId?: string;
  /** Cesión del QR del día: otro socio puede ingresar */
  transferidoASocioId?: string;
  transferidoANombre?: string;
  transferenciaExpira?: Date;
}

export interface EntradaPagoPendiente {
  id: string;
  eventId: string;
  seatId?: string;
  /** Compra múltiple en un solo pago */
  seatIds?: string[];
  seatCount?: number;
  amountPerSeat?: number;
  tier: EntradaPriceTier;
  amount: number;
  currency: string;
  /** auth uid del comprador o vacío si invitado */
  buyerUid?: string;
  buyerEmail?: string;
  buyerSocioId?: string;
  preferenceId?: string;
  createdAt: Date;
}
