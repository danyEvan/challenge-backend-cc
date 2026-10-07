---
trigger: model_decision
description: 'Aplicar al diseñar, implementar o revisar endpoints REST, DTOs, contratos HTTP y documentación de la API.'
---

# Diseño y contratos de API REST

Estas son convenciones de diseño reutilizables, no un formato universal de API. Preservar los contratos y excepciones explícitos del proyecto; no agregar funcionalidades para cumplir una convención. La regla no depende de un framework ni de documentación en rutas particulares.

## Recursos y rutas

- Representar recursos con sustantivos, no acciones RPC: `POST /orders`, no `POST /createOrder`.
- Usar rutas en minúsculas y recursos plurales; kebab-case para nombres compuestos. Un recurso único dentro de su dueño puede ser singular, como `/users/:userId/portfolio`.
- Limitar el anidamiento a dos niveles; utilizar filtros para relaciones más profundas. Diseñar rutas canónicas sin barra final.

## Métodos y estados

Respetar la semántica de [HTTP](https://www.rfc-editor.org/rfc/rfc9110.html):

- `GET`: seguro e idempotente, sin escrituras ni body de solicitud. `200` para resultados, incluso listados vacíos; `404` para un recurso específico inexistente.
- `POST`: no seguro ni necesariamente idempotente. `201` cuando crea un recurso, `200` para un resultado sin creación y `202` solo si el procesamiento es asíncrono. Para creaciones, preferir `Location` con la URI canónica como convención, no como obligación universal.
- `PUT`: idempotente, reemplaza el estado del recurso; `201` si crea y `200` o `204` si actualiza.
- `PATCH`: modificación parcial, sin asumir idempotencia. Si se adopta JSON Merge Patch, documentar su media type y el significado de `null`.
- `DELETE`: idempotente; `204` para eliminación sin cuerpo de respuesta.

No incorporar métodos o procesamiento asíncrono fuera del alcance. Referencias: [PATCH](https://www.rfc-editor.org/rfc/rfc5789.html) y [JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396.html).

## Entradas y parámetros

- Declarar `Content-Type` para cuerpos y formatos específicos; usar `Accept: application/json, application/problem+json` en ejemplos JSON. No exigir cabeceras adicionales sin definirlas en el contrato.
- Mantener casing consistente en JSON y query parameters; usar camelCase si no existe otra convención.
- Definir tipos, longitudes, rangos, campos permitidos y combinaciones. Rechazar parámetros desconocidos o repetidos cuando el contrato espera valores únicos.
- Parametrizar consultas y documentar si comodines de búsqueda son literales o parte de la sintaxis.
- Paginar solo recorridos que lo necesiten. Elegir cursor u offset según el caso; definir límites, defaults y orden estable, sin sustituir el contrato existente.
- Usar filtros y ordenamientos explícitos; por ejemplo, `status=active` o `sort=-createdAt,amount`.
- Para POST financieros críticos, definir idempotencia si forma parte del alcance: formato y alcance de clave, reutilización con otro payload y atomicidad de clave/resultado. Recibir `Idempotency-Key` no garantiza idempotencia.
- Documentar y propagar trazabilidad si se incorpora. No agregar headers ni infraestructura distribuida solo por esta convención.

## Respuestas

- Preferir objetos en la raíz: `{ data }` para un recurso y `{ data, meta }` para listados paginados. Preservar excepciones y contratos existentes; no afirmar cumplimiento de JSON:API por usar esos nombres.
- Definir campos, nulabilidad, fechas y significado de metadata. No incluir conteos o indicadores de paginación que no se calculen.
- Conservar precisión: importes financieros como strings decimales y cantidades enteras cuando no se admitan fracciones. Definir redondeo y presentación explícitamente.
- Usar DTOs o esquemas HTTP separados de los modelos de negocio. Evitar un envoltorio automático que cambie errores, respuestas sin cuerpo o contratos de infraestructura.

## Errores

- Usar [Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html), con `Content-Type: application/problem+json`, sin envolver el error en `data`.
- Definir `type`, `title`, `status`, `detail` e `instance`; agregar extensiones como `code` o `errors` de manera consistente con el contrato.
- Mantener códigos estables y detalles de validación útiles. No publicar credenciales, SQL, stack traces ni mensajes internos de persistencia.
- Traducir excepciones de negocio desde infraestructura. Distinguir un resultado de negocio rechazado de un error HTTP; el estado HTTP depende de si se creó un registro u ocurrió un fallo.

## Documentación y verificación

- Mantener implementación, especificación HTTP, ejemplos y pruebas alineados al cambiar un contrato.
- Actualizar la documentación y el cliente de solicitudes elegidos por el proyecto, sin introducir herramientas adicionales por esta regla.
- Comprobar casos e invariantes relevantes; registrar qué quedó implementado, verificado o pendiente.
