/** Valores fijos en external_reference Mercado Pago para abono público (una compra = un ítem). */
export const ABONO_PUBLICO_EVENT_ID = "ABONO_PUBLIC";
export const ABONO_PUBLICO_SEAT_ID = "SINGLE";

export function isAbonoPublicoEntrada(eventId: string, seatId: string): boolean {
  return eventId === ABONO_PUBLICO_EVENT_ID && seatId === ABONO_PUBLICO_SEAT_ID;
}
