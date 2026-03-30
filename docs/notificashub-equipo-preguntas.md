# NotificasHub — Mail al equipo (código + preguntas)

Referencias de archivos: **repositorio NotificasHub** (no regatas-admin).

Acá tenés la lista lista para mandar, **recortada** de lo que ese repo ya deja claro (así al “equipo” solo les pedís confirmación de producto/operativa donde haga falta). El código vive en `resolve-tenant.ts`, `register-user/route.ts`, `process-inbound.ts`, `tenant-webhook-payload.ts` y `whatsapp/send/route.ts`.

---

## Lo que ya responde el código (por si querés anexar un párrafo al mail)

- **Mismo número en varios tenants:** sí; `user_memberships` guarda `tenantIds: string[]`. Con **más de un** tenant, el flujo normal es **preguntar** (lista interactiva), salvo sesión reciente, último tenant elegido reciente, token de referral (`wa.me?text=…`) o resolución del mensaje como elección pendiente. Con **un solo** tenant va directo a `tenantIds[0]`. No hay `primaryTenantId` en el modelo que vi.
- **“Quién gana” si ya habló con otra app:** no hay “default Regatas”; domina **sesión / última elección** (ventana ~30 min) o **nueva lista**.
- **`register-user`:** **no** es `arrayUnion`; hace **append manual** al array si falta el `tenantId`. **No** reemplaza la membresía entera. Al pasar de 1→2 tenants limpia `wa_last_tenant` y sesiones para forzar nueva elección.
- **ID en Firestore:** el doc es `sanitizePhone(phone)` (solo dígitos suele coincidir con `wa_id` de Meta). Argentina: normalizan a `549…` en registro; conviene alinear con lo que Meta manda en `from`. Dos claves distintas (ej. variantes de número) = **dos documentos**, sin merge automático en el router.
- **Registro / envío:** `POST /api/register-user` y `DELETE /api/register-user` con `x-internal-token` o `x-internal-secret`; body JSON `{ phone, tenantId }`. Envío: `POST /api/whatsapp/send` o `POST /api/internal/send` (mismo handler) — token obligatorio; `tenantId` en body o header `x-tenant-id`; destino `to` o `phone` o `from`.
- **Webhook:** **una URL por tenant** (`tenants/{tenantId}.webhookUrl`). Formato `regatas_plus`: cuerpo `{ phone, tenantId, waMessageId, message: { type: "text"|"image", … } }`. Formato `meta`: payload más amplio (`message`, `from`, `contactName`, etc.).
- **`internalSecret`:** **por tenant** en Firestore; el token del header debe ser el del `tenantId` que validás.
- **Falla del webhook:** formato **meta:** un `fetch` síncrono, sin reintentos en código; se loguea y puede caer en mensaje fallback al usuario. **`regatas_plus`:** envío **asíncrono** (`after(...)`); si la respuesta no es OK, **no** hay cola de reintentos en este código — log + aviso al usuario por WhatsApp.

---

## Preguntas para el equipo (copiar/pegar)

**1. Multi-tenant y mismo número de WhatsApp**

- ¿Confirman que el comportamiento deseado coincide con lo implementado (lista, sesión ~30 min, referral, sin “tenant primario” en Firestore)?
- Si en el futuro quieren **prioridad fija** (ej. Regatas por defecto), ¿lo modelan en producto o esperan un campo tipo `primaryTenantId` / orden en `tenantIds`?
- ¿Recomendación oficial: **un número WABA por producto** cuando los flujos chocan, o el hub multi-tenant es el camino recomendado?

**2. Identidad del documento y telefonía**

- Para países fuera del esquema `549…`, ¿documentan la regla de normalización que deben usar las apps al llamar `register-user`?
- Si un socio crea membresía con formato distinto al `wa_id` de Meta, ¿procedimiento operativo (script, soporte) para unificar?

**3. Contrato API y tenant Regatas**

- ¿Valor canónico de **`tenantId` para Regatas** en prod (string exacto, case-sensitive) y ejemplo de `POST register-user` / `send` que deban usar en integraciones?
- ¿El webhook de Regatas debe seguir **`regatas_plus`** o hay variante nueva documentada?

**4. Seguridad y entorno**

- Rotación de `internalSecret`: ¿procedimiento acordado (doble secreto, ventana, aviso a integradores)?
- ¿Hay requisito de **IP allowlist** o solo header (hoy parece solo header)?

**5. Comportamiento operativo**

- ¿Dónde centralizan **observabilidad** (logs con `tenantId`, alertas cuando falla el POST al webhook)?
- SLA/expectativa cuando el downstream responde **200** pero procesa **async** (eventual consistency, idempotencia por `waMessageId`).

**6. Plantillas y Meta**

- ¿Quién **crea/aprueba** plantillas en la cuenta WABA del hub y cómo nombran/contratan plantillas por tenant?
- Política para mensajes **fuera de ventana 24 h**: ¿siempre template vía el mismo endpoint `send`?

**7. Datos, baja y auditoría**

- `DELETE register-user` **por tenant** borra el doc si el array queda vacío; ¿cómo piden **baja en todos los tenants** (N llamadas coordinadas, ticket interno, otro endpoint)?
- **Opt-in/opt-out** y trazabilidad: ¿ofrecen export o auditoría por tenant / compliance (GDPR u homólogo)?

---

Si mandás esto “tal cual”, el bloque **Lo que ya responde el código** evita que les pregunten de nuevo por cosas que ya están cerradas en implementación; podés quitarlo si el destinatario es solo negocio.
