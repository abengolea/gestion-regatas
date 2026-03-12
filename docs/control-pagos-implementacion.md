# Control de pagos – Guía de implementación

Documento para replicar en otra aplicación las funcionalidades implementadas en el módulo de control de pagos y morosos.

---

## 1. Funcionalidades implementadas

### 1.1 Listado de pagos ingresados
- Tabla de pagos con datos enriquecidos (nombre de jugador, período formateado, proveedor, estado)
- Filtros: concepto, mes/año, estado, proveedor
- Exportación a CSV respetando los filtros
- Registro manual de pagos
- Edición de período de pago (corrección de errores)

### 1.2 Listado de morosos
- Cálculo de morosos por inscripción, cuota mensual y ropa
- Filtros: concepto (inscripción / cuota mensual / ropa), subfiltros por mes/año o cuota de ropa
- Exportación a CSV según filtros aplicados
- Acciones: link de pago (Mercado Pago), pago manual

### 1.3 Filtros por concepto
- **Inscripción**: pagos o morosos de derecho de inscripción
- **Cuota mensual**: pagos o morosos de cuotas mensuales (YYYY-MM)
- **Ropa**: pagos o morosos de ropa (ropa-1, ropa-2, etc.)

---

## 2. Modelo de datos

### Periodos
- `inscripcion`: derecho de inscripción
- `YYYY-MM`: cuota mensual (ej. 2026-03)
- `ropa-N`: cuota N de pago de ropa (ropa-1, ropa-2)

### Campos de Payment
```
id, playerId, schoolId, period, amount, currency, provider,
status (pending|approved|rejected|refunded), paidAt, createdAt,
metadata, paymentType (monthly|registration|clothing)
```

### API de pagos
- `GET /api/payments?schoolId=&concept=&period=&status=&provider=&limit=&offset=`
- `POST /api/payments/manual` – pago manual
- `POST /api/payments/update` – editar período

### API de morosos
- `GET /api/payments/delinquents?schoolId=&concept=&period=`

---

## 3. Filtros y subfiltros

### UX recomendada
- **Selector principal**: Todos / Inscripción / Cuota mensual / Ropa
- **Cuota mensual**: subfiltros Mes y Año, evitando listas largas de todos los meses
- **Ropa**: subfiltro Cuota (Todas / Cuota 1 / Cuota 2 / …)

### Lógica de filtrado API
- `concept=inscripcion` → `period === "inscripcion"`
- `concept=monthly` + `period=2026-02` → cuotas mensuales de febrero 2026
- `concept=monthly` sin period → todas las cuotas mensuales
- `concept=clothing` + `period=ropa-1` → solo ropa cuota 1
- `concept=clothing` sin period → todas las cuotas de ropa

---

## 4. Exportación CSV

### Patrón
- CSV con BOM UTF-8 para acentos
- Columnas con escape de comillas
- Nombre de archivo con fecha: `pagos-YYYY-MM-DD.csv` o `morosos-YYYY-MM-DD.csv`
- Exportar solo los datos que coinciden con los filtros aplicados

### Ejemplo de columnas (pagos)
Período, Jugador, Monto, Moneda, Proveedor, Estado, Fecha pago, Fecha registro

### Ejemplo de columnas (morosos)
Jugador, Email, Período, Días mora, Monto, Moneda, Estado, Teléfono tutor, Nombre tutor

---

## 5. Optimizaciones de rendimiento

### Listado de pagos
- Límite por defecto en Firestore (ej. 150 docs) para evitar cargar miles de registros
- Solo consultar jugadores archivados cuando se necesite
- Evitar `db.collection('schools').get()` en el fallback de resolución de nombres

### Cálculo de morosos
- **Antes**: N×M consultas (jugadores × períodos)
- **Después**: 1 consulta para pagos aprobados y procesamiento en memoria
- Mapa `Map<playerId, Set<period>>` para búsquedas O(1)

### Índices Firestore necesarios
- `payments`: (schoolId, createdAt desc)
- `payments`: (schoolId, period, createdAt desc)
- `payments`: (schoolId, status)
- `players`: (archived == true) en subcolección por escuela

---

## 6. Componentes UI (React/Next.js)

- Select de Concepto con subfiltros condicionales
- Select Mes + Select Año cuando concepto = cuota mensual
- Select Cuota de ropa cuando concepto = ropa
- Botón “Exportar CSV”
- Toast para errores de carga

---

## 7. Checklist para otra app

- [ ] Definir modelo de periodos (inscripción, YYYY-MM, ropa-N)
- [ ] API de listado con filtros concept y period
- [ ] Lógica de cálculo de morosos (inscripción, mensual, ropa)
- [ ] Batch load de pagos aprobados para morosos
- [ ] Filtros en dos niveles (concepto + subfiltros)
- [ ] Exportación CSV con BOM UTF-8 y filtros aplicados
- [ ] Índices Firestore necesarios
- [ ] Límites en consultas para rendimiento
