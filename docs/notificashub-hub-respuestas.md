# NotificasHub — Respuestas y convenciones (referencia)

**Origen:** respuestas / documentación aportada por el equipo NotificasHub (no es un borrador saliente).  
**Código del hub:** repositorio NotificasHub — archivos como `resolve-tenant.ts`, `register-user/route.ts`, `process-inbound.ts`, `tenant-webhook-payload.ts`, `whatsapp/send/route.ts`.

---

## Comportamiento del hub (resumen)

- **Mismo número en varios tenants:** sí; `user_memberships` guarda `tenantIds: string[]`. Con **más de un** tenant, el flujo normal es **preguntar** (lista interactiva), salvo sesión reciente, último tenant elegido reciente, token de referral (`wa.me?text=…`) o resolución del mensaje como elección pendiente. Con **un solo** tenant va directo a `tenantIds[0]`. No hay `primaryTenantId` en el modelo descrito.
- **“Quién gana” si ya habló con otra app:** no hay “default Regatas”; domina **sesión / última elección** (ventana ~30 min) o **nueva lista**.
- **`register-user`:** no es `arrayUnion` de Firestore; hace **append manual** al array si falta el `tenantId`. No reemplaza la membresía entera. Al pasar de 1→2 tenants limpia `wa_last_tenant` y sesiones para forzar nueva elección.
- **ID en Firestore:** el doc es `sanitizePhone(phone)` (solo dígitos; alineado con `wa_id` de Meta). Argentina: normalizan a `549…` en registro; conviene alinear con lo que Meta envía. Dos variantes de número = **dos documentos**, sin merge automático en el router.
- **Registro / envío:** `POST /api/register-user` y `DELETE /api/register-user` con `x-internal-token` o `x-internal-secret`; body JSON `{ phone, tenantId }`. Envío: `POST /api/whatsapp/send` o `POST /api/internal/send` (mismo handler) — token obligatorio; `tenantId` en body o header `x-tenant-id`; destino según contrato del handler (p. ej. `to` / `phone`; verificar en el hub).
- **Webhook:** una URL por tenant (`tenants/{tenantId}.webhookUrl`). Para gestión-regatas el doc del tenant debe incluir **`webhookPayloadFormat: "regatas_plus"`** y **`internalAuthHeader: "x-internal-secret"`** (ver README/`setup-tenant-regatas` del hub); si no, el payload cae en formato **Meta** o el header por defecto no coincide. Formato `regatas_plus`: `{ phone, tenantId, waMessageId, message: { type: "text"|"image", … } }`.
- **`internalSecret`:** por tenant en Firestore; el token del header debe ser el del tenant que corresponda.
- **Falla del webhook:** formato **meta:** `fetch` síncrono, sin reintentos en código; log y posible fallback al usuario. **`regatas_plus`:** envío asíncrono (`after(...)`); si la respuesta no es OK, sin cola de reintentos en ese código — log + aviso al usuario por WhatsApp.

---

## Qué implica esto en **gestión-regatas** (este repo)

| Tema | Dónde está / qué hacer |
|------|-------------------------|
| `tenantId` Regatas | Código usa el literal **`regatas`** (`notificashub-register-user.ts`, filtro en `api/whatsapp/incoming/route.ts`). Mantener alineado con el tenant en Firestore del hub. |
| Webhook entrante | `POST /api/whatsapp/incoming` espera payload **`regatas_plus`** (configurar así en `tenants/{id}` del hub). Valida secreto con `NOTIFICASHUB_INTERNAL_SECRET` vía **`x-internal-secret`** o **`x-internal-token`**. |
| Registro de celular | `POST /api/notificashub/register-phone` y sync en alta/edición de jugador llaman a `NOTIFICASHUB_URL/api/register-user` con `tenantId: regatas`. Normalización `549…` en `normalize-phone.ts`. |
| Multi-tenant | Si un número tiene varios tenants en el hub, el **router del hub** decide si muestra lista o va directo; Regatas solo recibe tráfico cuando el hub enruta con `tenantId === regatas`. |

**Operativa:** mismo número `549…` en ficha, `register-user` y doc `user_memberships` del hub; en Firestore del tenant **`internalAuthHeader`** + **`webhookPayloadFormat`** como arriba.

---

## Seguimiento (si aún aplican)

Estas líneas eran **preguntas de verificación** en el intercambio original; tachá o completá cuando el hub las cierre por otro canal.

**Multi-tenant / producto**

- Prioridad fija futura (`primaryTenantId` u orden en `tenantIds`).
- Recomendación: un WABA por producto vs multi-tenant en un solo número.

**Telefonía**

- Normalización fuera de `549…`.
- Procedimiento si hay dos formatos para el mismo usuario.

**API / Regatas**

- Valor canónico final de `tenantId` en prod (si no es exactamente `regatas`).
- Variante de webhook distinta de `regatas_plus`.

**Seguridad y operación**

- Rotación de `internalSecret`, IP allowlist, observabilidad, SLA con respuesta 200 + proceso async.

**Plantillas y datos**

- Plantillas Meta por tenant; mensajes fuera de 24 h.
- Baja en todos los tenants; export / compliance.

---

*Documento anterior `notificashub-equipo-preguntas.md` reemplazado por este archivo (mismo contenido reencuadrado).*
