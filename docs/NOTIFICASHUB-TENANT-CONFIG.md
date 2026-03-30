# Configuración del tenant Regatas+ en NotificasHub

Para que el módulo de Viajes y Pagos funcione con WhatsApp, NotificasHub debe tener configurado el tenant de Regatas+ **con el mismo shape** que documenta el README del hub y `scripts/setup-tenant-regatas.ts`.

**Guía completa y checklist:** [notificashub-instrucciones.md](./notificashub-instrucciones.md)

---

## 1. Documento Firestore en el proyecto del hub

**Colección:** `tenants`  
**Documento ID:** `regatas` (o el id que coincidas con `NOTIFICASHUB_TENANT_ID` en gestión-regatas).

### Campos obligatorios para integrar con este proyecto

Además de URL y secreto, el hub necesita **estos dos campos**; sin ellos suele haber **401** en el webhook de Regatas (header por defecto `x-internal-token` mientras acá se validaba solo `x-internal-secret`) o **parser roto** (payload “meta” en lugar de `regatas_plus`):

| Campo | Valor | Motivo |
|--------|--------|--------|
| `internalAuthHeader` | `"x-internal-secret"` | El hub reenvía al webhook usando ese nombre de header; Regatas valida el secreto ahí (y también acepta `x-internal-token` como alias con el mismo valor). |
| `webhookPayloadFormat` | `"regatas_plus"` | Fuerza `{ phone, tenantId, waMessageId, message: { type, text?, imageUrl? } }`. Si falta, el hub usa formato Meta y este backend no parsea igual. |

### Ejemplo de documento completo (ajustar URL y secreto en prod)

```json
{
  "name": "Regatas+",
  "status": "active",
  "referralTokens": ["REGATAS", "REGATAS+"],
  "webhookUrl": "https://gestion-regatas--regatasadmin-3c6ee.us-east4.hosted.app/api/whatsapp/incoming",
  "internalSecret": "CAMBIAR_SECRETO_LARGO_ALEATORIO_EN_PROD",
  "internalAuthHeader": "x-internal-secret",
  "webhookPayloadFormat": "regatas_plus"
}
```

- **`webhookUrl`:** URL real de App Hosting (o ngrok en dev) + `/api/whatsapp/incoming`.
- **`internalSecret`:** en **dev** puede ser un ejemplo; en **prod** usar secreto largo aleatorio y el **mismo** valor en gestión-regatas (`NOTIFICASHUB_INTERNAL_SECRET` / Secret Manager `notificashub-internal-secret`).
- **`referralTokens`:** alineados con deep links `wa.me/...?text=REGATAS` según lo que exponga la app.

---

## 1b. Registro de teléfono (`user_memberships`)

La app Regatas+ llama al hub cuando se guarda o actualiza el celular del tutor (API `players/update`, importación masiva). El hub debe exponer:

- `POST /api/register-user` — body `{ "phone": "<solo dígitos AR normalizados 549…>", "tenantId": "regatas" }`, headers que exija el hub (típicamente `x-internal-secret` y/o `x-internal-token`).
- Opcional: `DELETE /api/register-user` — mismo cuerpo y headers, para baja si borran el número (idempotente).

Variables en gestión-regatas: `NOTIFICASHUB_URL`, `NOTIFICASHUB_INTERNAL_SECRET` (servidor; no commitear).

---

## 2. Cloud Function `onSocioCreated` (solo gestión-regatas)

**Es opcional** respecto del flujo mínimo “solo HTTP”:

- Si **solo** usás `register-user` desde la app al crear/editar/importar jugadores, **no** necesitás credenciales `NOTIFICASHUB_FIREBASE_*` en Functions.
- Si querés que **al crear** el doc en `subcomisiones/*/socios/*` también se escriba en **Firestore del hub** (`user_memberships`), entonces la función necesita:

  1. Variables en Firebase Functions: `NOTIFICASHUB_FIREBASE_PROJECT_ID`, `NOTIFICASHUB_FIREBASE_CLIENT_EMAIL`, `NOTIFICASHUB_FIREBASE_PRIVATE_KEY` (service account con acceso al proyecto **del hub**), o Secret Manager equivalente.

**No confundir** con las variables **Meta/WhatsApp** del propio hub (`WHATSAPP_*`): esas son del despliegue NotificasHub, no las define gestión-regatas.

---

## 3. Número público para `wa.me` (solo gestión-regatas)

`NEXT_PUBLIC_CLUB_WA_NUMBER` vive en **Regatas+** (App Hosting / `.env`) para armar enlaces `wa.me/{número}?text=REGATAS…`. **No reemplaza** la configuración Meta/WABA del hub; son capas distintas.

---

## 4. Verificación rápida

1. `tenants/regatas` incluye `internalAuthHeader`, `webhookPayloadFormat`, `webhookUrl`, `internalSecret`.
2. Secreto idéntico en hub y en `NOTIFICASHUB_INTERNAL_SECRET` de prod.
3. Tráfico entrante al webhook muestra payload chico `regatas_plus`, no el JSON completo de Meta.
