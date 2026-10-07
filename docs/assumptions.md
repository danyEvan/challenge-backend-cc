# Supuestos y decisiones

Este documento reúne los criterios funcionales y las decisiones técnicas relevantes para el alcance actual. Las reglas explícitas del challenge se conservan; las decisiones pendientes se indican al final.

## Disponibilidad y órdenes

Reglas del alcance: admitir `BUY`/`SELL`; MARKET usa el último `close` y se guarda `FILLED`; LIMIT exige precio y se guarda `NEW`. Validar disponibilidad antes de aceptar ambas. La solicitud proporciona cantidad entera positiva o monto positivo en ARS; se exige exactamente uno de los dos. Si se agrega cancelación, solo se permite para `NEW`.

| Tema                | Criterio elegido                                                                                              | Motivo                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Historial           | Solo `FILLED` afecta efectivo y cantidades, incluidas las LIMIT históricas ejecutadas.                        | El tipo de orden no determina si el movimiento ocurrió.                                                            |
| Reservas            | `NEW` no reserva efectivo ni acciones.                                                                        | Se reconstruyen recursos ejecutados; no se incorpora un sistema de reservas ni ejecución futura al alcance actual. |
| Cotización MARKET   | Usar el último `close` disponible por instrumento, sin exigir la fecha actual.                                | El dataset contiene cotizaciones históricas.                                                                       |
| Orden por monto     | Calcular cantidad entera con `floor(monto / precio aplicable)`, sin superar el monto enviado.                 | Las acciones se operan en unidades enteras.                                                                        |
| Importes de entrada | Recibir monto y precio como strings positivos, con hasta dos decimales y dentro de `NUMERIC(10,2)`.           | Evita pérdida de precisión y diferencias entre la evaluación y el valor persistido.                                |
| Rechazo financiero  | Persistir `REJECTED` cuando una solicitud válida excede efectivo o tenencia.                                  | El rechazo forma parte del historial; su registro debe confirmarse.                                                |
| Historial anómalo   | Conservar saldos y cantidades negativas heredadas. Impedir nuevas ventas superiores a la tenencia disponible. | Alterar el historial ocultaría inconsistencias del dataset.                                                        |

La política sin reservas permite que varias LIMIT `NEW` superen, en conjunto, los recursos actuales. Si se incorporara su ejecución futura, habría que definir reservas o revalidar disponibilidad al ejecutar.

Antes de evaluar recursos, órdenes valida que el instrumento exista y tenga tipo `ACCIONES`. `MONEDA`, tipos nulos y desconocidos no admiten `BUY`/`SELL`.

La creación de órdenes, sus validaciones, el cálculo por monto/cantidad, la persistencia de rechazos y el contrato HTTP `POST /orders` están implementados.

## Catálogo de instrumentos

`GET /instruments` expone únicamente activos negociables de tipo `ACCIONES`. El registro `ARS` de tipo `MONEDA` representa el efectivo usado para reconstruir la cuenta y el portfolio; no puede enviarse en órdenes `BUY`/`SELL` y no forma parte del catálogo público.

Los instrumentos con tipo nulo o desconocido tampoco se presentan como negociables. Incorporar un nuevo tipo al catálogo requiere decidir explícitamente que admite órdenes y agregarlo al contrato, en lugar de exponerlo automáticamente por existir en la tabla.

### Búsqueda e índices

Se revisó la extensión [`pg_trgm`](https://www.postgresql.org/docs/17/pgtrgm.html#PGTRGM-INDEX) como alternativa para acelerar búsquedas por subcadena. Permite crear índices compatibles con consultas `ILIKE '%texto%'` sobre ticker y nombre.

Por ahora se mantiene la consulta sin agregar esa extensión ni índices de búsqueda. El SQL provisto contiene 66 instrumentos y no hay mediciones que justifiquen esos cambios para el catálogo actual. Esta es una decisión de alcance; no se hizo una comparación de rendimiento con y sin índices.

Si aumenta el volumen o aparecen demoras, se revisará el plan con `EXPLAIN (ANALYZE, BUFFERS)` y se compararán alternativas con datos representativos antes de incorporar una migración.

## Portfolio

| Tema                  | Criterio elegido                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Efectivo y cantidades | Reconstruirlos desde movimientos ejecutados. `CASH_IN` y `CASH_OUT` usan `size` como pesos.                                                                                                           |
| Valor total           | Efectivo más la suma de cantidad por último `close` de cada posición.                                                                                                                                 |
| Costo de posición     | Promedio ponderado móvil: compras incorporan costo; ventas parciales lo reducen al promedio vigente; una posición válida cerrada reinicia el costo. Recorrer por `datetime`, con `id` como desempate. |
| Rendimiento           | `(valor actual − costo restante) / costo restante × 100`. Describe la posición abierta; no incluye la ganancia realizada de ventas previas.                                                           |
| Costo inválido        | Una sobreventa invalida costo y rendimiento (`null`), incluso si compras posteriores vuelven a dejar cantidad positiva. Un costo conocido de cero se informa como `"0.00"`, con rendimiento `null`.   |
| Datos insuficientes   | Informar explícitamente la falta de cotización o de datos necesarios. No reemplazarlos por cero ni presentar una valuación incompleta como total válido.                                              |

Portfolio está implementado en `GET /users/:userId/portfolio`, sin paginación y solo en ARS. Incluye `dailyPriceChangePercentage` para distinguir la variación diaria del precio del rendimiento sobre el costo. Si `previousClose` falta o no es positivo, ese indicador es `null`. Importes y porcentajes son strings de dos decimales, redondeados solo al presentar.

Los datos provistos contienen una venta ejecutada de BMA superior a la compra previa (usuario 1: −10 acciones). Se conserva el dato, su valor con signo y un warning interno, sin cambios de esquema, correcciones ni campos de anomalías en la respuesta. No se supone que sea una venta en corto autorizada. El futuro endpoint de órdenes deberá persistir `REJECTED` ante una venta que exceda la tenencia, como exige el challenge.

Un usuario inexistente produce `404`; uno existente sin movimientos, un portfolio vacío. Un historial ejecutado inválido produce `500 INVALID_ACCOUNT_HISTORY`. La ausencia de datos necesarios para valuar posiciones abiertas produce `500 PORTFOLIO_DATA_UNAVAILABLE`: no es un error de la solicitud ni se devuelve un total incompleto.

## Alcance y decisiones pendientes

- Los tres endpoints no requieren autenticación ni simulación del mercado. Cancelación e idempotencia son ampliaciones opcionales.
- Búsqueda, portfolio y órdenes están completamente implementados y documentados en el [contrato HTTP](api/README.md).
- Decisión cerrada: órdenes `MARKET` no aceptan precio enviado (usan el último `close`), y montos que deriven en cero acciones enteras (`floor`) son solicitudes inválidas rechazadas con `422` sin persistencia.

La [arquitectura](architecture.md) describe los límites entre módulos y la estrategia de consistencia. La [guía de PostgreSQL](../database/README.md) documenta las particularidades del dataset.
