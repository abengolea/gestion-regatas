# Instrucciones NotificasHub ↔ Regatas (gestión-regatas)

Guía para **quien configure el hub** o **revise integración** cuando haga falta. El backend de Regatas vive en Firebase App Hosting (`gestion-regatas`, proyecto `regatasadmin-3c6ee`).

---

## 1. Tenant en Firestore del hub

**Colección:** `tenants`  
**Documento:** debe coincidir con el id que usa Regatas (por defecto `regatas`; si usan otro, ver sección 6).

Campos mínimos típicos:

| Campo | Descripción |
|--------|-------------|
| `webhookUrl` | URL **HTTPS** del backend Regatas + ruta del webhook (sin barra final en el dominio completo; la ruta es `/api/whatsapp/incoming`). **Ej. prod:** `https://gestion-regatas--regatasadmin-3c6ee.us-east4.hosted.app/api/whatsapp/incoming` |
| `internalSecret` | Secreto compartido; el mismo valor que Regatas tiene en `NOTIFICASHUB_INTERNAL_SECRET` (ver Secret Manager / env). |
| `status` | p. ej. `active` |
| `name` | Nombre visible |

**Importante:** Si `webhookUrl` apunta a un dominio viejo o a localhost, los mensajes **no** llegan al bot de viajes/comprobantes de Regatas.

---

## 2. Llamada al webhook (Regatas recibe)

Regatas valida el header **`x-internal-secret`** contra su variable de entorno (no usa el secreto del body).

**Payload** (formato tipo `regatas_plus`): JSON con al menos:

- `phone` — número del usuario (mejor alineado a dígitos estilo Meta / `549…` para AR).
- `message` — `{ "type": "text" \| "image", "text"?: string, "imageUrl"?: string }`.
- `tenantId` — **opcional pero recomendable**; si falta, Regatas asume el tenant configurado en su env (`NOTIFICASHUB_TENANT_ID`, por defecto `regatas`).
- `waMessageId` — recomendado para trazas.

Si el hub envía un `tenantId` distinto al que Regatas espera, el mensaje se **acepta con 200** pero **no se procesa** (queda log en servidor).

---

## 3. Registro de números (`register-user`)

Regatas llama desde servidor:

- `POST {NOTIFICASHUB_URL}/api/register-user`
- Headers: `Content-Type: application/json`, **`x-internal-secret`** y **`x-internal-token`** con el mismo valor que acepte el hub para ese tenant (en nuestro deploy suelen ir iguales).
- Body: `{ "phone": "<normalizado AR, típico 549…>", "tenantId": "<mismo id que tenants/{id}>" }`.

Análogo para baja: `DELETE` mismo path y cuerpo.

**Teléfono:** Regatas normaliza a **`549…`** para coincidir con `wa_id` y con el **ID del documento** `user_memberships/{phone}` en el hub. Si el hub guarda otro formato, pueden existir **dos membresías** para el mismo humano y el router del hub puede no ver `regatas` en el doc que usa Meta.

---

## 4. Envío de mensajes (hub → Meta, disparado por Regatas)

Regatas usa:

- `POST {NOTIFICASHUB_URL}/api/internal/send` (o ruta equivalente documentada por el hub).
- Headers: `x-internal-secret`, **`x-tenant-id`** = mismo id de tenant que arriba.
- Body: según contrato del hub (`phone`, `type: text`, `text`, etc.).

---

## 5. Multi-tenant (mismo celular, varias apps)

Si `user_memberships` tiene **varios** `tenantIds`, el hub suele mostrar **lista** para elegir app; no hay “Regatas por defecto” solo por existir en el array. Conviene:

- Que **`register-user`** haya agregado `regatas` al doc correcto (`549…`).
- Que el usuario **elija Regatas** en el chat cuando el hub lo pida.

Sin eso, el usuario puede recibir el flujo de **otra** app aunque Regatas esté dado de alta.

---

## 6. Variables en Regatas (App Hosting / `.env`)

| Variable | Uso |
|----------|-----|
| `NOTIFICASHUB_URL` | Base del hub, sin `/` final. |
| `NOTIFICASHUB_INTERNAL_SECRET` | Igual a `internalSecret` del tenant en el hub (Secret Manager en prod). |
| `NOTIFICASHUB_TENANT_ID` | **Opcional.** Por defecto `regatas`. Poner el **mismo** string que el `documentId` en `tenants/` si no es `regatas`. |
| `NEXT_PUBLIC_NOTIFICASHUB_ACTIVO` | `true` si la UI debe mostrar integración activa. |

Comentarios y secretos: ver `apphosting.yaml` (proyecto `regatasadmin-3c6ee`).

---

## 7. Cloud Function Regatas (`onSocioCreated`)

Opcional pero recomendada: escribe en **Firestore del hub** `user_memberships` con el mismo criterio de teléfono **canónico** (`549…`). Requiere en Functions: `NOTIFICASHUB_FIREBASE_*` (proyecto del hub). Si no está configurada, sigue valiendo el **`register-user`** HTTP al guardar/editar jugador o importación.

---

## 8. Checklist rápido si “no identifica como Regatas”

1. En hub: `tenants/{id}.webhookUrl` = URL real de App Hosting + `/api/whatsapp/incoming`.
2. En hub y Regatas: **`internalSecret` / secret** idénticos.
3. Mismo **`tenantId`** en Firestore, en `register-user`, en payload del webhook y en `NOTIFICASHUB_TENANT_ID` si no es `regatas`.
4. En hub: documento `user_memberships/{teléfono_en_549}` con `tenantIds` que incluya ese id de tenant.
5. Usuario con **varias apps**: confirmar que eligió Regatas en el menú del hub, no solo que escribió al número.

---

## 9. Referencias en este repo

- Código webhook: `src/app/api/whatsapp/incoming/route.ts`
- Registro hub: `src/lib/whatsapp/notificashub-register-user.ts`
- Tenant y secreto: `src/lib/whatsapp/notificashub-env.ts`
- Cliente envío: `src/lib/whatsapp/NotificasHubClient.ts`
- Convenciones del hub (resumen): `docs/notificashub-hub-respuestas.md`
- Config histórica tenant: `docs/NOTIFICASHUB-TENANT-CONFIG.md` (actualizar `webhookUrl` de ejemplo si quedó dominio viejo)
