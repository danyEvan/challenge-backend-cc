# Contrato HTTP

Swagger está disponible en `/api/docs`. El archivo [REST Client](cocos-capital.http) contiene las solicitudes para probar la API y utiliza el puerto local predeterminado. Los [pasos de preparación](../../README.md#evaluación-rápida) y [uso de la API](../../README.md#probar-la-api) se mantienen en el README central. Los tres endpoints, health y la idempotencia obligatoria de órdenes están implementados.

## Buscar instrumentos

`GET /instruments`

Busca una subcadena en ticker **o** nombre, sin distinguir mayúsculas. Devuelve únicamente activos negociables de tipo `ACCIONES`, junto con un resumen de su última cotización disponible. El registro `ARS` de tipo `MONEDA` representa efectivo interno y se excluye del catálogo. Los tipos nulos o desconocidos también quedan afuera.

| Parámetro | Regla                                                                                                                                    | Predeterminado |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `search`  | String de hasta 255 caracteres después de quitar espacios en los extremos. Ausente, vacío o solo espacios devuelve el catálogo paginado. | `""`           |
| `limit`   | Entero entre 1 y 100, escrito con dígitos decimales.                                                                                     | `20`           |
| `offset`  | Entero entre 0 y 2147483647, escrito con dígitos decimales.                                                                              | `0`            |

No se admiten parámetros desconocidos ni repetidos. Los parámetros numéricos vacíos, fraccionarios, negativos o expresados como hexadecimal o notación científica producen `400`.

La consulta es parametrizada. `%`, `_`, `!` y `\` se buscan como texto literal y no permiten ampliar la búsqueda mediante comodines SQL. No hay búsqueda aproximada por distancia ni normalización de acentos.

El carácter nulo (`U+0000`, por ejemplo `search=%00`) no es válido en texto de PostgreSQL y se rechaza con `400` antes de consultar la base.

Los resultados se ordenan por `ticker ASC NULLS LAST` e `id ASC` como desempate. La página contiene como máximo `limit` elementos y no calcula un conteo total. Sin coincidencias o con un offset posterior al resultado devuelve `200` con `data: []` y los parámetros en `meta`.

### Respuesta

`GET /instruments?search=gal`

```json
{
  "data": [
    {
      "id": 34,
      "ticker": "GGAL",
      "name": "Grupo Financiero Galicia",
      "type": "ACCIONES",
      "lastClose": "885.80",
      "quoteDate": "2023-07-14",
      "dailyPriceChangePercentage": "-3.48"
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

El formato de éxito de negocio es `{ data, meta }` para listados paginados y `{ data }` para recursos individuales. El controller traduce el resultado interno del caso de uso a ese DTO HTTP. Cada elemento de `data` expone `id`, `ticker`, `name`, `type`, `lastClose`, `quoteDate` y `dailyPriceChangePercentage`. `ticker` y `name` admiten `null`, como en el SQL provisto. `type` siempre es `ACCIONES` por la política de operabilidad. No se reemplazan datos ausentes ni se omite un activo negociable que coincida por el otro campo.

`lastClose` es el `close` del registro seleccionado de `marketdata`, en ARS y como string de dos decimales; **no es una cotización en tiempo real ni una oferta ejecutable**. `quoteDate` es su fecha `YYYY-MM-DD`, o `null` si no consta. La variación diaria es `(close − previousClose) / previousClose × 100`, como string de dos decimales, sin símbolo `%` y con `ROUND_HALF_UP`; mide el precio del activo, no el rendimiento del usuario. Se elige el registro por `date DESC NULLS LAST, id DESC`, igual que para las otras lecturas de cotizaciones. Sin registro, los tres campos son `null`. Si el registro seleccionado carece de cierre, `lastClose` y la variación son `null`; si carece de fecha, `quoteDate` y la variación son `null`, porque no se puede atribuir el cambio a un día. No se reemplaza un cierre faltante por otro más antiguo. Si `previousClose` falta o no es positivo, solo la variación es `null`. Un cierre negativo es un dato inválido y produce `500` controlado. Las cotizaciones del seed son históricas.

El envoltorio `data/meta` es una convención de este proyecto y no implica cumplimiento de JSON:API. `meta.limit` indica el máximo de elementos por página, no la cantidad devuelta. `meta.offset` indica cuántos resultados se omiten. No se incluyen total, cantidad de páginas ni indicador de página siguiente.

## Consultar portfolio

`GET /users/:userId/portfolio`

`userId` debe escribirse con dígitos decimales y estar entre 1 y 2147483647. No admite query parameters ni paginación porque el total y las posiciones describen la cuenta completa. La ruta identifica al dueño. El endpoint pertenece a `PortfolioModule`, sin requerir un módulo de usuarios.

La respuesta es `{ data: { userId, currency, totalValue, cashBalance, reservedCash, availableCash, positions } }`. `currency` es `ARS`. Las transferencias aportan efectivo, no una posición adicional de moneda. Los movimientos `FILLED` determinan saldo, posiciones y patrimonio. Las órdenes `NEW` reservan capacidad de operación sin modificar esos valores ejecutados.

`cashBalance` es el efectivo ejecutado. `reservedCash` suma `size × price` para compras `NEW` y `availableCash` es la diferencia entre ambos. `totalValue` usa `cashBalance`, porque una reserva no reduce el patrimonio. Las posiciones de cantidad ejecutada cero se omiten y las restantes se ordenan por ticker/id, con ticker nulo al final.

Cada posición contiene:

| Campo                        | Tipo / significado                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instrumentId`               | Entero.                                                                                                                                                                |
| `ticker`, `name`             | String o `null`, sin reemplazar datos ausentes.                                                                                                                        |
| `quantity`                   | Entero con signo, reconstruido del historial.                                                                                                                          |
| `reservedQuantity`           | Cantidad comprometida por ventas `NEW`. No reduce la tenencia ejecutada.                                                                                               |
| `availableQuantity`          | Máximo entre `quantity − reservedQuantity` y cero. Es la cantidad disponible para nuevas ventas.                                                                       |
| `marketPrice`                | Último `close` disponible.                                                                                                                                             |
| `marketValue`                | Cantidad × precio, conservando el signo.                                                                                                                               |
| `costBasis`                  | Costo restante por promedio ponderado móvil. Es `null` si hubo sobreventa.                                                                                             |
| `returnPercentage`           | `(valor − costo) / costo × 100`. Es `null` si el costo es cero o no reconstruible. No incluye ganancias realizadas.                                                    |
| `dailyPriceChangePercentage` | `(close − previousClose) / previousClose × 100`. Es `null` si el precio anterior falta o no es positivo. Mide la variación del precio, no el rendimiento de la cuenta. |
| `quoteDate`                  | Fecha `YYYY-MM-DD` de la cotización utilizada.                                                                                                                         |

Los importes, incluidos `totalValue`, `cashBalance`, `reservedCash` y `availableCash`, y los porcentajes se presentan como strings de dos decimales, sin símbolo `%`, con `ROUND_HALF_UP`. El cálculo conserva precisión interna hasta la presentación. Las cotizaciones pueden ser históricas y no se simula el mercado.

Con el seed, el usuario 1 devuelve saldo `753000.00`, efectivo reservado `125500.00`, disponible `627500.00` y total `889756.00`. Las reservas corresponden a dos compras LIMIT `NEW` por `35500.00` y `90000.00`:

| Ticker | Cantidad | Reservada | Disponible | Valor     | Costo     | Rendimiento (%) |
| ------ | -------- | --------- | ---------- | --------- | --------- | --------------- |
| BMA    | −10      | 0         | 0          | −15028.00 | `null`    | `null`          |
| METR   | 500      | 0         | 500        | 114750.00 | 125000.00 | −8.20           |
| PAMP   | 40       | 0         | 40         | 37034.00  | 37200.00  | −0.45           |

La posición negativa heredada se informa y genera un warning interno, sin campos adicionales ni correcciones de datos. No implica soporte de ventas en corto. Si falta el instrumento, la fecha o el precio necesario para valuar una posición abierta, se devuelve `500` controlado, no un total parcial.

Un usuario existente sin movimientos devuelve `200` con los cuatro importes en `"0.00"` y `positions: []`. Uno inexistente devuelve `404`.

## Errores HTTP

El filtro compartido presenta las excepciones como Problem Details, con `Content-Type: application/problem+json`.

| Situación                                 | Estado                 | Código                       |
| ----------------------------------------- | ---------------------- | ---------------------------- |
| Solicitud inválida                        | `400`                  | `INVALID_REQUEST`            |
| Ruta o recurso inexistente                | `404`                  | `NOT_FOUND`                  |
| Otras excepciones HTTP anteriores a 500   | Estado de la excepción | `HTTP_ERROR`                 |
| Fallo técnico inesperado                  | `500`                  | `INTERNAL_ERROR`             |
| Historial ejecutado no reconstruible      | `500`                  | `INVALID_ACCOUNT_HISTORY`    |
| Datos insuficientes para valuar portfolio | `500`                  | `PORTFOLIO_DATA_UNAVAILABLE` |

Ejemplo de validación de `limit=101`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "limit must not be greater than 100",
  "instance": "/instruments",
  "code": "INVALID_REQUEST",
  "errors": ["limit must not be greater than 100"]
}
```

`instance` identifica el path, sin query string. Los errores conocidos publican un detalle seguro y los fallos inesperados conservan detalle y log genéricos, sin información de PostgreSQL. Health mantiene su respuesta propia, incluido su `503`.

## Enviar órdenes

`POST /orders`

Permite enviar una orden de compra o venta (`BUY` o `SELL`), ya sea por cantidad de acciones exacta o por monto a invertir en ARS (mutuamente excluyentes). Soporta órdenes `MARKET` y `LIMIT`.

### Idempotencia obligatoria

`POST /orders` exige un UUID v4 en la cabecera `Idempotency-Key`. Su ausencia o formato inválido devuelve `400 INVALID_REQUEST` en el middleware, antes de ejecutar el caso de uso o escribir en PostgreSQL. Su alcance es el `userId` del cuerpo. La clave, el código HTTP y el resultado se confirman en una misma transacción.

- Repetir la misma clave con un payload equivalente devuelve `201` y exactamente la misma orden, sin crear otra fila en `orders`.
- Esto también aplica a una orden `REJECTED`: es un resultado de negocio persistido y el reintento devuelve el mismo `id` y estado.
- Reutilizarla para ese usuario con un payload diferente devuelve `409 IDEMPOTENCY_CONFLICT`.
- Los importes se comparan normalizados: por ejemplo, `"90"` y `"90.00"` representan el mismo valor.
- Un fallo técnico inesperado durante la operación se revierte hasta un savepoint y se confirma como `500` junto con la clave, sin crear la orden. Su repetición devuelve el mismo resultado.
- Si falta el último `close` para una MARKET, se devuelve `500 MARKET_DATA_UNAVAILABLE` sin guardar orden ni clave. Una vez disponible la cotización, se puede reintentar con la misma clave.
- Si no puede confirmarse el registro idempotente —por ejemplo, por pérdida de conexión o commit incierto— no se afirma que el `500` haya quedado guardado. Si el commit de la orden sí ocurrió pero se perdió la respuesta, el reintento recupera la orden.

Las claves no expiran automáticamente en este alcance. El cliente debe generar una clave distinta para cada intención de crear una orden.

Un `500` con `Idempotency-Outcome: finalized` confirma un fallo guardado sin orden: repetir la clave devuelve el mismo `500`; una nueva intención requiere otra clave. `MARKET_DATA_UNAVAILABLE` se devuelve **sin** esa cabecera porque la transacción se revierte y no crea orden ni clave. Ante otros `500` sin cabecera o un timeout, el resultado puede ser incierto: el cliente conserva clave y cuerpo y reintenta con límite de intentos, sin asumir que la orden se creó o rechazó.

Las claves que ya tenían un resultado confirmado conservan ese resultado; la regla de reintento por cotización ausente se aplica a intentos nuevos.

### Cuerpo de la solicitud

| Campo          | Tipo           | Obligatorio / Regla                                                                                                    |
| -------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `userId`       | Entero         | Sí (entero positivo).                                                                                                  |
| `instrumentId` | Entero         | Sí (entero positivo).                                                                                                  |
| `side`         | String         | Sí (`BUY` o `SELL`).                                                                                                   |
| `type`         | String         | Sí (`MARKET` o `LIMIT`).                                                                                               |
| `size`         | Entero         | Opcional, entre 1 y 2147483647. Mutuamente excluyente con `amount`.                                                    |
| `amount`       | String decimal | Opcional, positivo, máximo `99999999.99` y hasta dos decimales. Mutuamente excluyente con `size`.                      |
| `price`        | String decimal | Obligatorio para `LIMIT`, positivo, máximo `99999999.99` y hasta dos decimales. Prohibido en órdenes de tipo `MARKET`. |

### Conversión de monto y reglas financieras

- Cuando se envía `amount`, la cantidad de acciones se calcula como `floor(monto / precio aplicable)`.
- Si el resultado de la conversión es cero acciones, la solicitud se considera inválida, responde `422 Unprocessable Entity` con Problem Details y **no se persiste**.
- Para órdenes `MARKET`, el precio aplicable es el último valor `close` disponible del instrumento en `marketdata`.
- Para órdenes `LIMIT`, el precio aplicable es el `price` límite provisto.
- **Validación de disponibilidad**:
  - `BUY`: se valida que el efectivo no reservado alcance (`availableCash >= precio × cantidad`).
  - `SELL`: se valida que las acciones no reservadas alcancen (`availableQuantity >= cantidad`).
- Si los recursos son insuficientes, el control previo a la operación la **persiste** con estado `REJECTED` y devuelve `201 Created`. El motivo queda en el log interno y no amplía el contrato de la orden.
- Si los recursos son suficientes:
  - Una orden `MARKET` se ejecuta inmediatamente y se persiste con estado `FILLED`.
  - Una orden `LIMIT` se persiste con estado `NEW` y aparece como reserva en consultas posteriores de portfolio.

La disponibilidad se reconstruye desde los movimientos `FILLED` y las órdenes `NEW` previas. El bloqueo transaccional por usuario serializa solicitudes simultáneas, por lo que una segunda orden se valida después de incorporar la reserva confirmada por la primera.

### Respuesta exitosa (`201 Created`)

```json
{
  "data": {
    "id": 105,
    "userId": 1,
    "instrumentId": 47,
    "side": "BUY",
    "type": "MARKET",
    "size": 5,
    "price": "925.85",
    "status": "FILLED",
    "datetime": "2023-07-14T15:30:00.000Z"
  }
}
```

### Errores y códigos Problem Details

| Situación                                    | Estado | Código                    |
| -------------------------------------------- | ------ | ------------------------- |
| Idempotency-Key ausente o no UUID v4         | `400`  | `INVALID_REQUEST`         |
| Parámetros inválidos o exclusión size/amount | `400`  | `INVALID_REQUEST`         |
| Idempotency-Key reutilizada con otro payload | `409`  | `IDEMPOTENCY_CONFLICT`    |
| Usuario no encontrado                        | `404`  | `NOT_FOUND`               |
| Instrumento no encontrado                    | `404`  | `NOT_FOUND`               |
| Instrumento existente no negociable          | `422`  | `INSTRUMENT_NOT_TRADABLE` |
| Orden resulta en 0 acciones o inválida       | `422`  | `INVALID_ORDER`           |
| Cotización ausente para orden MARKET         | `500`  | `MARKET_DATA_UNAVAILABLE` |
| Fallo técnico inesperado                     | `500`  | `INTERNAL_ERROR`          |
