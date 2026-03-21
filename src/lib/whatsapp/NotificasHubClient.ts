/**
 * Cliente para enviar mensajes por WhatsApp vía NotificasHub.
 * Regatas+ — No llama directo a Meta, todo pasa por el hub.
 */

export class NotificasHubClient {
  private static getBaseUrl(): string {
    return process.env.NOTIFICASHUB_URL ?? 'https://notificashub.com';
  }

  private static getSecret(): string {
    return process.env.NOTIFICASHUB_INTERNAL_SECRET ?? '';
  }

  static async sendText(phone: string, text: string): Promise<void> {
    const secret = this.getSecret();
    if (!secret) {
      console.warn('[NotificasHubClient] NOTIFICASHUB_INTERNAL_SECRET no configurado');
      return;
    }

    const res = await fetch(`${this.getBaseUrl()}/api/internal/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
        'x-tenant-id': 'regatas',
      },
      body: JSON.stringify({
        phone,
        type: 'text',
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NotificasHub sendText failed: ${res.status} ${err}`);
    }
  }

  static async sendTemplate(
    phone: string,
    template: string,
    params: string[]
  ): Promise<void> {
    const secret = this.getSecret();
    if (!secret) {
      console.warn('[NotificasHubClient] NOTIFICASHUB_INTERNAL_SECRET no configurado');
      return;
    }

    const res = await fetch(`${this.getBaseUrl()}/api/internal/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
        'x-tenant-id': 'regatas',
      },
      body: JSON.stringify({
        phone,
        type: 'template',
        template,
        params,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NotificasHub sendTemplate failed: ${res.status} ${err}`);
    }
  }
}
