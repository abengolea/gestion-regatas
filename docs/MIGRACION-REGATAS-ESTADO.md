# Estado de migración Escuelas River → Regatas+

## Completado

### PASO 1 — Renombrar colecciones y constantes
- ✅ Find & replace global aplicado (193 archivos)
- Terminología: school→subcomision, player→socio, School Admin→Presidente de Subcomisión, etc.
- Firestore rules e indexes actualizados

### PASO 2 — Tipo Socio
- ✅ Interface `Socio` definida en `src/lib/types/index.ts` con campos nuevo modelo Regatas+
- ✅ Campos legacy (firstName, lastName, etc.) para compatibilidad

### PASO 3 — Colección comercios
- ✅ `src/lib/types/comercio.ts` — tipos Comercio y EstadoConvenio
- ✅ `src/lib/comercios.ts` — CRUD: getComercio, getComerciosActivos, createComercio, updateComercio, deleteComercio

### PASO 4 — Módulo QR
- ✅ `src/lib/qr.ts` — generarQRToken, validarQRToken (jose)
- ⚠️ Ejecutar `npm install jose` si no está instalado

### PASO 5 — Rutas API QR
- ✅ `app/api/qr/generar/route.ts` — POST, genera token para socio autenticado
- ✅ `app/api/qr/validar/route.ts` — POST, valida token y registra uso en `usos_qr`

### PASO 6 — Subcomisiones seed
- ✅ `src/lib/data/subcomisiones-seed.ts` — SUBCOMISIONES_INICIALES

### PASO 7 — Variables de entorno
- ✅ `.env.example` actualizado con QR_JWT_SECRET, NEXT_PUBLIC_CLUB_NOMBRE, NEXT_PUBLIC_CLUB_SLUG

---

## Pendiente / Errores a corregir

Hay ~150+ errores de TypeScript por incompatibilidades entre:
- APIs que reciben `schoolId`/`playerId` vs tipos que esperan `subcomisionId`/`socioId`
- PlatformUser: agregar `super_admin` en cast para lectura de Firestore
- Rutas de payments, platform-fee, players: aceptar ambos nombres en body
- Import paths: algunos componentes movidos/renombrados (ej. ClubFeeBanner, MedicalRecordField)
- DelinquentInfo, PaymentIntent, etc.: compatibilidad de campos

### Estrategia recomendada
1. **Compatibilidad en APIs**: En cada ruta que recibe body, hacer:
   ```ts
   const schoolId = body.subcomisionId ?? body.schoolId;
   const playerId = body.socioId ?? body.playerId;
   ```
2. **PlatformUser/super_admin**: Donde se lee platformUsers, castear a `{ gerente_club?: boolean; super_admin?: boolean }` y verificar ambos.
3. **Firestore**: La colección real puede seguir siendo `schools` y `players` hasta migrar datos. Para usar `subcomisiones`/`socios` sin migrar, crear un script de migración de datos.

### Firestore — migración de datos
Para que la app funcione con las nuevas colecciones, se necesita un script que copie:
- `schools` → `subcomisiones`
- `schools/{id}/players` → `subcomisiones/{id}/socios`
- `playerLogins` → `socioLogins` (o mantener ambos durante transición)
- `pendingPlayerByEmail` → `pendingSocioByEmail`

---

## Cómo verificar
```bash
npm install jose   # si falta
npx tsc --noEmit   # ver errores restantes
npm run dev        # puerto 9003
```
