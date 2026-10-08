# Supuestos y decisiones

Este documento explica las decisiones de negocio y las simplificaciones del challenge. El [contrato HTTP](api/README.md) define la API; la [arquitectura](architecture.md), su implementación.

## Disponibilidad y órdenes

| Tema                   | Decisión                                                                                       | Motivo                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Historial              | Solo `FILLED` modifica efectivo, tenencias y patrimonio.                                       | Una orden pendiente o rechazada no es un movimiento ejecutado.         |
| Instrumentos           | `BUY` y `SELL` operan solo `ACCIONES`.                                                         | `MONEDA` representa efectivo.                                          |
| MARKET                 | No recibe precio: usa el último `close` y queda `FILLED`.                                      | Es la regla de ejecución simplificada que exige el challenge.          |
| LIMIT                  | Exige precio y queda `NEW`: BUY reserva efectivo; SELL, acciones.                              | La orden compromete recursos sin cambiar todavía el patrimonio.        |
| Orden por monto        | Usa `floor(monto / precio)`; si da cero acciones, no se persiste.                              | No hay acciones fraccionarias ni órdenes ejecutables de cantidad cero. |
| Precisión              | Monto y precio llegan como strings con hasta dos decimales.                                    | Evita perder precisión al recibirlos.                                  |
| Recursos insuficientes | La orden se guarda `REJECTED`; el motivo queda solo en logs.                                   | El rechazo es un resultado de negocio persistido.                      |
| Historial anómalo      | Se conservan saldos negativos heredados, pero no se aceptan nuevas ventas sin acciones libres. | Corregir el seed ocultaría sus inconsistencias.                        |

El cliente solo envía `BUY` o `SELL`; la API asigna el estado. Portfolio y órdenes reconstruyen la misma disponibilidad desde `FILLED` y las reservas `NEW`, sin guardar saldos duplicados. El motivo de un rechazo se registra después del commit con `[orders.rejected]`: no se persiste ni se expone en la respuesta, que devuelve `201`.

### Alcance frente a una operatoria real

El challenge pide ejecutar MARKET de inmediato al último `close` y dejar LIMIT en `NEW`; no provee libro de órdenes ni exige simularlo. En [BYMA](https://home.byma.com.ar/sba/descargas/manuales/ManualdeusuarioEOMM.pdf), una MARKET negocia contra las ofertas disponibles y una LIMIT puede ejecutarse al ingresar o parcialmente. [Cocos](https://alyc.cocos.capital/alyc-terminos-y-condiciones.html) describe operaciones al mejor precio del momento según la modalidad. Por eso, el `close` es el precio convencional de este ejercicio, **no una oferta ejecutable ni una garantía de precio real**.

Reservar recursos de órdenes pendientes evita ofrecer como disponible lo ya comprometido; el modelo no incluye ejecuciones parciales, comisiones ni liquidación. Tampoco expone cancelación: si se incorpora, solo una orden `NEW` podrá pasar a `CANCELLED` y liberar su reserva.

### Idempotencia

`POST /orders` exige un UUID v4 en `Idempotency-Key` para que un reintento no duplique la orden; es una decisión adicional al challenge.

| Situación                               | Resultado                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Misma clave, usuario y payload          | Devuelve el resultado original sin crear otra orden.                                 |
| Misma clave y usuario, payload distinto | Devuelve `409 IDEMPOTENCY_CONFLICT`.                                                 |
| Orden `REJECTED`                        | Se confirma y se reproduce como cualquier otro resultado de negocio.                 |
| Cotización MARKET ausente               | Devuelve `500` sin crear orden ni guardar la clave; permite reintentarla.            |
| Fallo técnico confirmado                | Guarda un `500` seguro sin orden e informa `Idempotency-Outcome: finalized`.         |
| Commit incierto                         | No promete un resultado guardado. El cliente reintenta con la misma clave y payload. |

La falta de `close` es un dato externo necesario para evaluar una MARKET; la solicitud puede ser válida, por eso conserva `500 MARKET_DATA_UNAVAILABLE` en vez de tratarse como error del cliente. Se detecta antes de escribir la orden y se revierte la clave para permitir un nuevo intento cuando llegue el dato. Los fallos técnicos inesperados confirmados sí quedan guardados para no repetir una operación incierta.

PostgreSQL confirma la clave y el resultado en la misma transacción, incluso ante solicitudes concurrentes. No hay expiración automática porque el challenge no define retención. El [contrato HTTP](api/README.md#idempotencia-obligatoria) detalla los reintentos y errores.

## Catálogo de instrumentos

`GET /instruments` devuelve solo `ACCIONES`: `ARS` es efectivo y no se negocia aquí. Los tipos nulos o desconocidos se excluyen hasta definir cómo operarlos.

El catálogo muestra el último `close` y su variación frente a `previousClose` como referencia histórica, con fecha y sin presentarlos como cotización en vivo. Solo lee cotizaciones de la página; los datos ausentes quedan `null`, sin recurrir a registros anteriores. La variación requiere fecha, cierre y `previousClose` positivo. No se agregó una ruta individual que repita el listado.

### Búsqueda e índices

Con 66 instrumentos en el seed, no se midió un beneficio que justifique `pg_trgm` o un índice para búsqueda por subcadena. Si el catálogo crece, corresponde medir con datos representativos y `EXPLAIN (ANALYZE, BUFFERS)`.

### Índices de órdenes y cotizaciones

Se probaron índices B-tree para los movimientos `FILLED` de un usuario y para la última cotización por instrumento. La base evaluada tenía 11 órdenes, 126 cotizaciones y 66 instrumentos.

| Consulta             | Plan antes y después           | Antes    | Después  |
| -------------------- | ------------------------------ | -------- | -------- |
| Órdenes ejecutadas   | `Seq Scan` + `Sort`            | 0,064 ms | 0,071 ms |
| Últimas cotizaciones | `Seq Scan` + `Sort` + `Unique` | 0,074 ms | 0,101 ms |

PostgreSQL no utilizó esos índices; cada tiempo proviene de una sola ejecución, insuficiente para concluir que hubo mejora o regresión. Se retiró la migración para este volumen. La restricción única de idempotencia permanece por corrección. Si crecen historial o cotizaciones, habrá que volver a medir.

## Portfolio

| Tema                | Decisión                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Saldo               | Transferencias `FILLED`: `size` en pesos. BUY resta y SELL suma `size × price`.                                        |
| Disponibilidad      | Efectivo: saldo menos reservas BUY `NEW`. Acciones: `max(cantidad − reservas SELL NEW, 0)`.                            |
| Valor total         | Saldo ejecutado más `cantidad × último close` de cada posición; las reservas no restan patrimonio.                     |
| Costo               | Promedio ponderado móvil de compras ejecutadas, ordenadas por `datetime` e `id`; las ventas reducen el costo restante. |
| Rendimiento         | `(valor actual − costo restante) / costo restante × 100` para la posición abierta.                                     |
| Sobreventa          | Invalida costo y rendimiento (`null`), aun si compras posteriores revierten la cantidad negativa.                      |
| Datos insuficientes | No se inventan ceros ni se devuelve un total con posiciones sin valuar.                                                |

`returnPercentage` es el rendimiento no realizado de las acciones aún en cartera, **no el resultado total histórico de invertir en ese activo**: no incluye ganancias realizadas, dividendos ni gastos. El cambio diario del precio usa `(close − previousClose) / previousClose × 100`; es `null` sin precio anterior positivo. Importes y porcentajes se redondean a dos decimales solo al responder. El valor al cierre es una estimación del patrimonio, no el importe garantizado de una venta.

El seed deja BMA en −10 acciones para el usuario 1. Se informa cantidad y valor con signo, sin corregir el historial ni afirmar que la API soporte ventas en corto; nuevas ventas no pueden repetir la anomalía.

## Fuera de alcance

- Autenticación de usuarios.
- Libro de órdenes, ejecuciones parciales, ejecución o cancelación posterior de `LIMIT`.
- Corrección del historial provisto o soporte de ventas en corto.
- Cotizaciones en tiempo real.
- Comisiones, impuestos, dividendos y liquidación de operaciones.

Los endpoints están en el [contrato HTTP](api/README.md); el seed y las migraciones, en la [guía de PostgreSQL](../database/README.md).
