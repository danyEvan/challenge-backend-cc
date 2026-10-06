---
trigger: model_decision
description: 'Aplicar al diseñar, implementar o revisar endpoints REST, DTOs, contratos HTTP y documentación de la API.'
---

# Estándares de diseño y contratos de API REST

Antes de trabajar en un endpoint, consultar el [contrato HTTP](../../docs/api/README.md), la [arquitectura](../../docs/architecture.md) y los [supuestos funcionales](../../docs/assumptions.md).

Esta regla establece convenciones de recursos, contratos, respuestas y errores para este proyecto. Aplicarlas mediante los mecanismos idiomáticos del stack existente: controllers, DTOs y filtros HTTP en NestJS. Mantener dominio y aplicación independientes del framework.

Las respuestas de éxito de los endpoints de negocio usan `data` y, para listados paginados, `meta`. Health conserva su contrato de infraestructura. Las excepciones específicas del challenge se indican en esta regla. Cualquier cambio de contrato debe incluir implementación, documentación, ejemplos y pruebas que coincidan.

---

## 1. Modelado de recursos y diseño de rutas

- **Solo sustantivos:** Los endpoints deben representar recursos, nunca acciones o estilo RPC.
  - Correcto: `POST /orders`, `GET /users`
  - Incorrecto: `POST /createOrder`, `GET /get-users`
- **Plural y casing:** Los recursos deben ir en minúsculas y en plural. Los recursos compuestos deben usar kebab-case (`/payment-methods`).
  - Los recursos únicos pueden ser singulares: `/users/:userId/portfolio`. `/health` conserva su contrato de infraestructura.
- **Límite de anidamiento:** Máximo dos niveles de recursos: `/parents/{parentId}/children`. Para relaciones más profundas, usar query parameters: `/items?categoryId={id}&supplierId={id}`.
- **Sin barra final:** Diseñar rutas canónicas sin barra final, como `/users`.

---

## 2. Métodos HTTP y códigos de estado

Respetar la semántica de cada verbo y documentar el comportamiento de la operación:

- `GET`: Seguro e idempotente. Nunca modifica estado ni recibe body.
  - `200 OK`: Devuelve el recurso o listado solicitado.
  - `404 Not Found`: El recurso específico no existe.
- `POST`: No seguro y sin garantía de idempotencia por el verbo. Para creación de recursos o ejecución de procesos.
  - `201 Created`: Recurso creado. Incluir `Location` con la URI canónica del recurso como convención del proyecto. HTTP también permite identificarlo mediante la URI de la solicitud; no presentar esta convención como una obligación universal.
  - `200 OK`: Procesamiento sincrónico completado que no crea un recurso.
  - `202 Accepted`: Trabajo aceptado y todavía pendiente; documentar cómo se consulta su resultado si se incorpora ese flujo.
- `PUT`: Idempotente. Reemplazo completo del estado del recurso.
  - `201 Created` si crea un recurso.
  - `200 OK` (con el recurso modificado) o `204 No Content`.
- `PATCH`: Modificación parcial; su idempotencia depende de la operación. No asumir que todo PATCH usa Merge Patch.
  - `200 OK` (con el recurso modificado) o `204 No Content`.
  - Si se adopta JSON Merge Patch, documentar `Content-Type: application/merge-patch+json` y el tratamiento de `null`.
- `DELETE`: Idempotente. Eliminación del recurso.
  - `204 No Content`: Eliminado con éxito o ya inexistente. Sin cuerpo de respuesta.

Estas convenciones no agregan endpoints PUT/PATCH/DELETE ni ejecución asíncrona al alcance del challenge. Referencias: [HTTP](https://www.rfc-editor.org/rfc/rfc9110.html), [PATCH](https://www.rfc-editor.org/rfc/rfc5789.html), [JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396.html).

---

## 3. Requests y parámetros de consulta

- **Cabeceras:** Peticiones con cuerpo JSON deben enviar `Content-Type: application/json`, salvo formatos específicos documentados, como Merge Patch. En ejemplos de clientes, indicar `Accept: application/json, application/problem+json`. No exigir cabeceras adicionales en el servidor sin definirlas en el contrato.
- **Casing:** Las claves JSON y parámetros de consulta deben mantener consistencia en todo el proyecto (por defecto: `camelCase`).
- **Convenciones para Query Params:**
  - **Paginación:** Preferir `?cursor={token}&limit={n}` para recorridos que lo necesiten. Para desplazamiento, usar `?offset={n}&limit={n}`; para páginas, `?page={n}&limit={n}`. La búsqueda actual conserva `limit/offset`, con límites y valores predeterminados definidos en el contrato.
  - **Filtros:** Campos explícitos: `?status=active&createdAfter=2026-01-01T00:00:00Z`.
  - **Ordenamiento:** Lista separada por comas, anteponiendo `-` para orden descendente: `?sort=-createdAt,amount`.
- **Validación:** Comprobar tipos, longitudes, rangos, campos permitidos y combinaciones antes de persistir. Rechazar parámetros repetidos cuando se espera un único valor. Parametrizar consultas y documentar el tratamiento literal de comodines en búsquedas.
- **Cabeceras de control y trazabilidad:**
  - `Idempotency-Key`: Requerida como estándar general para POST financieros críticos; definir formato, alcance, reutilización con otro payload y atomicidad de clave/resultado. Recibir el header no constituye por sí solo una garantía.
  - **Excepción vigente del challenge:** idempotencia sigue siendo una ampliación opcional, conforme a los [supuestos](../../docs/assumptions.md#alcance-y-decisiones-pendientes). No exigir el header ni ampliar su implementación por aplicar esta regla. Si se incorpora, verificar la garantía con PostgreSQL.
  - `X-Correlation-ID` o W3C `traceparent`: Documentar y propagar si se incorpora trazabilidad. No agregar infraestructura distribuida únicamente para cumplir esta convención.

---

## 4. Respuestas y envoltorios

Queda prohibido devolver arrays en la raíz del JSON. Toda respuesta con payload debe ser un objeto.

Definir campos, tipos, nulabilidad y fechas explícitamente. Usar DTOs de salida y conservar precisión: importes como strings decimales y cantidades como enteros. Evitar un interceptor que envuelva indiscriminadamente contratos existentes, errores o respuestas `204`.

### Recurso individual (`200 OK` / `201 Created`)

Usar `data` como envoltorio de los éxitos de negocio. El siguiente ejemplo es orientativo y no representa un endpoint de órdenes implementado:

```json
{
  "data": {
    "id": 101,
    "price": "2500.00",
    "currency": "ARS",
    "status": "FILLED",
    "createdAt": "2026-10-06T12:00:00Z"
  }
}
```

### Listados

Usar `data` para los elementos y `meta` para los datos de paginación, con orden estable. La búsqueda implementada utiliza este formato, sin conteo total:

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

## 5. Errores

- Usar el filtro compartido de Problem Details y `Content-Type: application/problem+json`. Presentar el error en la raíz, sin envolverlo en `data`. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html).
- Mantener `type`, `title`, `status`, `detail`, `instance`, `code` y, cuando corresponda, `errors`, según el [contrato implementado](../../docs/api/README.md#errores-http).
- Mantener códigos estables y detalles útiles de validación. No publicar credenciales, SQL, stack traces ni mensajes internos de persistencia.
- Las excepciones propias de negocio son independientes de NestJS; se definen al implementar una condición real de fallo y se traducen a HTTP desde infraestructura. Los errores de validación HTTP usan el mecanismo existente. Una búsqueda sin coincidencias devuelve `200` y `data: []`.
- Diferenciar errores HTTP del resultado financiero de una orden. El criterio propuesto para registrar órdenes es `201` con estado `FILLED`, `NEW` o `REJECTED`: se crea el registro incluso cuando el resultado financiero es rechazo. Documentarlo al implementar el flujo; todavía está pendiente.

## 6. Documentación y verificaciones

- Al completar un endpoint, actualizar Swagger, [contrato HTTP](../../docs/api/README.md), [REST Client](../../docs/api/cocos-capital.http) y pasos de uso del [README](../../README.md). Mantener REST Client como único archivo de solicitudes de la entrega, siguiendo el [índice de documentación](../../docs/README.md).
- Comprobar contrato HTTP y comportamiento con pruebas relevantes, siguiendo las [reglas de negocio](trading-architecture.md).
- Registrar implementación, decisiones pendientes y verificaciones en `.agents/context.md` local, si existe.
