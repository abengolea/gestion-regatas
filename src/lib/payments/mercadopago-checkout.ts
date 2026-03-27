/**
 * Creación de preferencia de Checkout Pro en Mercado Pago.
 * Usa el access_token de la escuela (OAuth por escuela).
 */

import { MercadoPagoConfig, Preference } from 'mercadopago';

export interface CreatePreferenceParams {
  socioId: string;
  subcomisionId: string;
  period: string;
  amount: number;
  currency: string;
}

export interface CreatePreferenceResult {
  init_point: string;
  preference_id: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';

/**
 * Crea una preferencia en Mercado Pago y devuelve init_point y id.
 * external_reference = schoolId|playerId|period para el webhook.
 * notification_url incluye schoolId para poder usar el token correcto al consultar el pago.
 */
export async function createMercadoPagoPreference(
  accessToken: string,
  params: CreatePreferenceParams
): Promise<CreatePreferenceResult> {
  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
  const preferenceClient = new Preference(client);

  const title =
    params.period === 'inscripcion'
      ? 'Derecho de inscripción - Regatas+'
      : params.period.startsWith('ropa-')
        ? `Pago de ropa (${params.period.replace('ropa-', '')}) - Regatas+`
        : `Cuota ${params.period} - Regatas+`;

  const notificationUrl = `${BASE_URL}/api/payments/webhook/mercadopago?schoolId=${encodeURIComponent(params.subcomisionId)}`;
  const externalReference = `${params.subcomisionId}|${params.socioId}|${params.period}`;

  const paymentsUrl = `${BASE_URL}/dashboard/payments`;
  const body = {
    items: [
      {
        id: `cuota-${params.period}-${params.socioId}`,
        title,
        quantity: 1,
        unit_price: params.amount,
        currency_id: params.currency,
      },
    ],
    back_urls: {
      success: `${paymentsUrl}?payment=success`,
      failure: `${paymentsUrl}?payment=failure`,
      pending: `${paymentsUrl}?payment=pending`,
    },
    auto_return: 'approved' as const,
    notification_url: notificationUrl,
    external_reference: externalReference,
  };

  const response = await preferenceClient.create({ body });

  const initPoint = response.init_point ?? response.sandbox_init_point;
  const preferenceId = response.id;

  if (!initPoint || !preferenceId) {
    throw new Error('Mercado Pago no devolvió init_point o id de preferencia');
  }

  return { init_point: initPoint, preference_id: preferenceId };
}

export interface CreateEntradaPreferenceParams {
  subcomisionId: string;
  pendingId: string;
  eventId: string;
  /** Un asiento (compat.) */
  seatId?: string;
  /** Varios asientos; si hay más de uno, `amount` es el total y el webhook usa entrada-multi. */
  seatIds?: string[];
  amount: number;
  currency: string;
  title: string;
  /** Si viene, Checkout Pro redirige aquí en lugar del panel de entradas. */
  backUrls?: { success: string; failure: string; pending: string };
  /**
   * Fuerza `external_reference` tipo entrada-multi aunque haya un solo asiento
   * (necesario para webhooks que no usan applyEntrada de un solo día).
   */
  forceMultiExternalRef?: boolean;
}

function normalizeEntradaSeatIds(params: CreateEntradaPreferenceParams): string[] {
  if (params.seatIds && params.seatIds.length > 0) {
    return params.seatIds;
  }
  if (params.seatId) {
    return [params.seatId];
  }
  return [];
}

/** Preferencia Checkout Pro para una o varias plateas; external_reference según cantidad. */
export async function createMercadoPagoEntradaPreference(
  accessToken: string,
  params: CreateEntradaPreferenceParams
): Promise<CreatePreferenceResult> {
  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 5000 },
  });
  const preferenceClient = new Preference(client);

  const seatIds = normalizeEntradaSeatIds(params);
  if (seatIds.length === 0) {
    throw new Error('Falta seatId o seatIds para la preferencia de entrada');
  }

  const notificationUrl = `${BASE_URL}/api/payments/webhook/mercadopago?schoolId=${encodeURIComponent(params.subcomisionId)}`;
  const isMulti = seatIds.length > 1 || params.forceMultiExternalRef === true;
  const externalReference = isMulti
    ? `${params.subcomisionId}|${params.pendingId}|entrada-multi`
    : `${params.subcomisionId}|${params.pendingId}|entrada:${params.eventId}:${seatIds[0]}`;
  const backDefault = `${BASE_URL}/dashboard/subcomisiones/${params.subcomisionId}/entradas`;
  const back = params.backUrls ?? {
    success: `${backDefault}?pago=ok`,
    failure: `${backDefault}?pago=error`,
    pending: `${backDefault}?pago=pendiente`,
  };

  const items = isMulti
    ? [
        {
          id: `entrada-${params.eventId}-x${seatIds.length}`,
          title: params.title,
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ]
    : [
        {
          id: `entrada-${params.eventId}-${seatIds[0]}`,
          title: params.title,
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ];

  const body = {
    items,
    back_urls: {
      success: back.success,
      failure: back.failure,
      pending: back.pending,
    },
    auto_return: 'approved' as const,
    notification_url: notificationUrl,
    external_reference: externalReference,
  };

  const response = await preferenceClient.create({ body });
  const initPoint = response.init_point ?? response.sandbox_init_point;
  const preferenceId = response.id;
  if (!initPoint || !preferenceId) {
    throw new Error('Mercado Pago no devolvió init_point o id de preferencia');
  }
  return { init_point: initPoint, preference_id: preferenceId };
}
