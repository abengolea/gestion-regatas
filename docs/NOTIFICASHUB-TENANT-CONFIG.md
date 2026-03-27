# Configuración del tenant Regatas+ en NotificasHub

Para que el módulo de Viajes y Pagos funcione con WhatsApp, NotificasHub debe tener configurado el tenant de Regatas+.

## 1. Crear documento en Firestore del Hub

En el proyecto Firebase de NotificasHub, crear:

**Colección:** `tenants`  
**Documento ID:** `regatas`

```json
{
  "name": "Regatas+",
  "status": "active",
  "referralTokens": ["REGATAS", "REGATAS+"],
  "webhookUrl": "https://regatasplus.com.ar/api/whatsapp/incoming",
  "internalSecret": "regatas_internal_2026"
}
```

- `webhookUrl`: URL de producción. En desarrollo usar ngrok o similar.
- `internalSecret`: Debe coincidir con `NOTIFICASHUB_INTERNAL_SECRET` en `.env`.

## 1b. Registro de teléfono (`user_memberships`)

La app Regatas+ llama al hub cuando se guarda o actualiza el celular del tutor (API `players/update`, importación masiva). El hub debe exponer:

- `POST /api/register-user` — body `{ "phone": "<solo dígitos AR normalizados>", "tenantId": "regatas" }`, header `x-internal-secret`.
- Opcional: `DELETE /api/register-user` — mismo cuerpo y header, para baja si borran el número (idempotente).

Variables en Regatas: `NOTIFICASHUB_URL`, `NOTIFICASHUB_INTERNAL_SECRET` (servidor; no commitear).

## 2. Cloud Function onSocioCreated

La función `onSocioCreated` registra automáticamente la membresía cuando se crea un socio con celular. Requiere configuración en Firebase:

1. **Variables de entorno** (Firebase Console → Functions → Variables de entorno):
   - `NOTIFICASHUB_FIREBASE_PROJECT_ID`: ID del proyecto del Hub
   - `NOTIFICASHUB_FIREBASE_CLIENT_EMAIL`: Service account del Hub
   - `NOTIFICASHUB_FIREBASE_PRIVATE_KEY`: Private key del Hub

2. O usar **Secret Manager** para credenciales sensibles.

## 3. Número de WhatsApp del club

Configurar `NEXT_PUBLIC_CLUB_WA_NUMBER` en `.env` (ej: `5491112345678`). Se usa en la página de pago para el link `wa.me/{número}?text=REGATAS`.
