# Supuestos y decisiones

Este documento registra las decisiones tomadas donde el challenge deja margen de interpretación. El [contrato HTTP](api/README.md) contiene parámetros, respuestas y errores. La [arquitectura](architecture.md) explica implementación, transacciones y concurrencia.

## Disponibilidad y órdenes

| Tema                   | Decisión                                                                                            | Motivo                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Historial              | Solo los movimientos `FILLED` modifican efectivo y tenencias.                                       | El estado confirma si el movimiento ocurrió, independientemente del tipo.  |
| Instrumentos           | `BUY` y `SELL` se permiten únicamente sobre `ACCIONES`.                                             | `MONEDA` representa efectivo y no es un activo negociable.                 |
| MARKET                 | Usa el último `close` disponible y no acepta un precio enviado.                                     | El challenge no exige cotización en tiempo real ni simulación del mercado. |
| LIMIT                  | Exige precio, queda `NEW` y no reserva recursos.                                                    | No se implementa ejecución futura ni administración de reservas.           |
| Orden por monto        | La cantidad es `floor(monto / precio)`. Un resultado de cero acciones es inválido y no se persiste. | No se admiten fracciones y tampoco existe una orden ejecutable de cero.    |
| Precisión              | Monto y precio se reciben como strings con hasta dos decimales.                                     | Evita pérdida de precisión antes de convertirlos a valores monetarios.     |
| Recursos insuficientes | Una solicitud válida se guarda como `REJECTED`.                                                     | El rechazo financiero forma parte del historial de órdenes.                |
| Historial anómalo      | Los saldos negativos existentes se conservan, pero una nueva venta no puede superar la tenencia.    | Corregir el seed ocultaría sus inconsistencias.                            |

El cliente solo puede enviar `BUY` o `SELL` y no puede elegir `status`. La evaluación asigna `FILLED`, `NEW` o `REJECTED`, por lo que `POST /orders` no permite introducir estados arbitrarios.

Como consecuencia de no reservar recursos, varias órdenes `LIMIT` en estado `NEW` pueden superar en conjunto la disponibilidad actual. Una ejecución futura deberá incorporar reservas o volver a validar los recursos.

La cancelación no forma parte de los tres endpoints solicitados. Si se incorpora, la única transición válida será `NEW → CANCELLED`. Los demás estados serán terminales. No se agregó una máquina de estados sin un caso de uso que la necesite.

### Idempotencia

Aunque el challenge no la exige, `POST /orders` requiere un UUID v4 en `Idempotency-Key` para que un reintento no duplique una operación financiera.

| Situación                               | Resultado                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Misma clave, usuario y payload          | Devuelve el resultado original sin crear otra orden.                                 |
| Misma clave y usuario, payload distinto | Devuelve `409 IDEMPOTENCY_CONFLICT`.                                                 |
| Orden `REJECTED`                        | Se confirma y se reproduce como cualquier otro resultado de negocio.                 |
| Fallo técnico confirmado                | Guarda un `500` seguro sin orden e informa `Idempotency-Outcome: finalized`.         |
| Commit incierto                         | No promete un resultado guardado. El cliente reintenta con la misma clave y payload. |

PostgreSQL es la fuente de verdad y resuelve también solicitudes concurrentes. Cada resultado se confirma con su clave y, cuando corresponde, con la orden en una misma transacción. No hay expiración automática porque el challenge no define una política de retención. El comportamiento HTTP completo está en la sección de [idempotencia del contrato](api/README.md#idempotencia-obligatoria).

## Catálogo de instrumentos

`GET /instruments` devuelve únicamente `ACCIONES`. `ARS`, de tipo `MONEDA`, representa el efectivo de la cuenta. Los tipos nulos o desconocidos también se excluyen hasta que exista una decisión explícita sobre cómo operarlos.

### Búsqueda e índices

No se agregó `pg_trgm` ni un índice para la búsqueda por subcadena. El seed contiene 66 instrumentos y no se midió un beneficio que justifique sumar esa extensión. Si el catálogo crece o aparecen demoras, corresponde comparar alternativas con datos representativos y `EXPLAIN (ANALYZE, BUFFERS)`.

### Índices de órdenes y cotizaciones

Se probaron índices B-tree para los movimientos `FILLED` de un usuario y para la última cotización por instrumento. La base evaluada tenía 11 órdenes, 126 cotizaciones y 66 instrumentos.

| Consulta             | Plan antes y después           | Antes    | Después  |
| -------------------- | ------------------------------ | -------- | -------- |
| Órdenes ejecutadas   | `Seq Scan` + `Sort`            | 0,064 ms | 0,071 ms |
| Últimas cotizaciones | `Seq Scan` + `Sort` + `Unique` | 0,074 ms | 0,101 ms |

PostgreSQL no utilizó los índices y cada medición corresponde a una sola ejecución. Estos valores no permiten afirmar una mejora ni una regresión. Se retiró la migración porque el volumen actual no compensa el costo adicional de escritura y almacenamiento. La restricción única de idempotencia sí se conserva porque garantiza corrección, no performance.

Esta decisión debe revisarse si crecen el historial por usuario o las cotizaciones por instrumento.

## Portfolio

| Tema                | Decisión                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Recursos            | Efectivo y cantidades se reconstruyen con movimientos `FILLED`. `CASH_IN` y `CASH_OUT` usan `size` como pesos.        |
| Valor total         | Es el efectivo más el valor de cada posición al último `close` disponible.                                            |
| Costo               | Se usa promedio ponderado móvil, procesando por `datetime` e `id`.                                                    |
| Rendimiento         | Mide solo la posición abierta: `(valor actual − costo restante) / costo restante × 100`.                              |
| Sobreventa          | Invalida costo y rendimiento, que se informan como `null`, aunque compras posteriores reviertan la cantidad negativa. |
| Datos insuficientes | No se reemplazan por cero ni se devuelve una valuación parcial como total válido.                                     |

El cambio diario de precio se calcula aparte con `close` y `previousClose`. Si el precio anterior falta o no es positivo, el porcentaje es `null`. Los importes y porcentajes se presentan como strings de dos decimales y se redondean solo al responder.

El seed contiene una venta ejecutada de BMA que deja al usuario 1 con −10 acciones. Se conserva la cantidad y su valor con signo, sin corregir datos ni asumir soporte de ventas en corto. Las órdenes nuevas impiden repetir esa anomalía.

## Fuera de alcance

- Autenticación de usuarios.
- Simulación, ejecución o cancelación posterior de órdenes `LIMIT`.
- Reservas de efectivo o tenencias para órdenes `NEW`.
- Corrección del historial provisto o soporte de ventas en corto.
- Cotizaciones en tiempo real.

Los tres endpoints implementados y sus validaciones están documentados en el [contrato HTTP](api/README.md). Las particularidades del seed y las migraciones están en la [guía de PostgreSQL](../database/README.md).
