# Contrato HTTP

Swagger está disponible en `/api/docs`. El archivo [REST Client](cocos-capital.http) contiene las solicitudes para probar la API y utiliza el puerto local predeterminado. Los [pasos de preparación](../../README.md#ejecutar-el-proyecto) y [uso de la API](../../README.md#probar-la-api) se mantienen en el README central. Búsqueda, portfolio y health están implementados. Órdenes sigue pendiente.

## Buscar instrumentos

`GET /instruments`

Busca una subcadena en ticker **o** nombre, sin distinguir mayúsculas. Devuelve únicamente activos negociables de tipo `ACCIONES`. El registro `ARS` de tipo `MONEDA` representa efectivo interno y se excluye del catálogo; también se excluyen tipos nulos o desconocidos.

| Parámetro | Regla                                                                                                                                    | Predeterminado |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `search`  | String de hasta 255 caracteres después de quitar espacios en los extremos. Ausente, vacío o solo espacios devuelve el catálogo paginado. | `""`           |
| `limit`   | Entero entre 1 y 100, escrito con dígitos decimales.                                                                                     | `20`           |
| `offset`  | Entero entre 0 y 2147483647, escrito con dígitos decimales.                                                                              | `0`            |

No se admiten parámetros desconocidos ni repetidos. Los parámetros numéricos vacíos, fraccionarios, negativos o expresados como hexadecimal o notación científica producen `400`.

La consulta es parametrizada. `%`, `_`, `!` y `\` se buscan como texto literal; no permiten ampliar la búsqueda mediante comodines SQL. No hay búsqueda aproximada por distancia ni normalización de acentos.

El carácter nulo (`U+0000`, por ejemplo `search=%00`) no es válido en texto de PostgreSQL y se rechaza con `400` antes de consultar la base.

Los resultados se ordenan por `ticker ASC NULLS LAST` e `id ASC` como desempate. La página contiene como máximo `limit` elementos; no calcula un conteo total. Sin coincidencias o con un offset posterior al resultado devuelve `200` con `data: []` y los parámetros en `meta`.

### Respuesta

`GET /instruments?search=gal`

```json
{
  "data": [
    {
      "id": 34,
      "ticker": "GGAL",
      "name": "Grupo Financiero Galicia",
      "type": "ACCIONES"
    }
  ],
  "meta": {
    "limit": 20,
    "offset": 0
  }
}
```

El formato de éxito de negocio es `{ data, meta }` para listados paginados y `{ data }` para recursos individuales. El controller traduce el resultado interno del caso de uso a ese DTO HTTP. Cada elemento de `data` expone únicamente `id`, `ticker`, `name` y `type`. `ticker` y `name` admiten `null`, como en el SQL provisto; `type` siempre es `ACCIONES` por la política de operabilidad. No se reemplazan datos ausentes ni se omite un activo negociable que coincida por el otro campo.

El envoltorio `data/meta` es una convención de este proyecto; no implica cumplimiento de JSON:API. `meta.limit` indica el máximo de elementos por página, no la cantidad devuelta; `meta.offset` indica cuántos resultados se omiten. No se incluyen total, cantidad de páginas ni indicador de página siguiente.

## Consultar portfolio

`GET /users/:userId/portfolio`

`userId` debe escribirse con dígitos decimales y estar entre 1 y 2147483647. No admite query parameters ni paginación: el total y las posiciones describen la cuenta completa. La ruta identifica al dueño; el endpoint pertenece a `PortfolioModule`, sin requerir un módulo de usuarios.

La respuesta es `{ data: { userId, currency, totalValue, availableCash, positions } }`. `currency` es `ARS`; las transferencias aportan efectivo, no una posición adicional de moneda. Solo movimientos `FILLED` afectan el cálculo. Las posiciones de cantidad cero se omiten y las restantes se ordenan por ticker/id, con ticker nulo al final.

Cada posición contiene:

| Campo                        | Tipo / significado                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `instrumentId`               | Entero.                                                                                                                                                            |
| `ticker`, `name`             | String o `null`, sin reemplazar datos ausentes.                                                                                                                    |
| `quantity`                   | Entero con signo, reconstruido del historial.                                                                                                                      |
| `marketPrice`                | Último `close` disponible.                                                                                                                                         |
| `marketValue`                | Cantidad × precio, conservando el signo.                                                                                                                           |
| `costBasis`                  | Costo restante por promedio ponderado móvil; `null` si hubo sobreventa.                                                                                            |
| `returnPercentage`           | `(valor − costo) / costo × 100`; `null` si el costo es cero o no reconstruible. No incluye ganancias realizadas.                                                   |
| `dailyPriceChangePercentage` | `(close − previousClose) / previousClose × 100`; `null` si el precio anterior falta o no es positivo. Es variación del precio, no rendimiento diario de la cuenta. |
| `quoteDate`                  | Fecha `YYYY-MM-DD` de la cotización utilizada.                                                                                                                     |

Los importes (también `totalValue` y `availableCash`) y porcentajes se presentan como strings de dos decimales, sin símbolo `%`, con `ROUND_HALF_UP`. El cálculo conserva precisión interna hasta la presentación. Las cotizaciones pueden ser históricas; no se simula el mercado.

Con el seed, el usuario 1 devuelve efectivo `753000.00` y total `889756.00`:

| Ticker | Cantidad | Valor     | Costo     | Rendimiento (%) |
| ------ | -------- | --------- | --------- | --------------- |
| BMA    | −10      | −15028.00 | `null`    | `null`          |
| METR   | 500      | 114750.00 | 125000.00 | −8.20           |
| PAMP   | 40       | 37034.00  | 37200.00  | −0.45           |

La posición negativa heredada se informa y genera un warning interno, sin campos adicionales ni correcciones de datos. No implica soporte de ventas en corto. Si falta el instrumento, la fecha o el precio necesario para valuar una posición abierta, se devuelve `500` controlado, no un total parcial.

Un usuario existente sin movimientos devuelve `200` con importes `"0.00"` y `positions: []`; uno inexistente devuelve `404`.

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
  - `BUY`: se valida que el usuario posea efectivo suficiente (`availableCash >= precio × cantidad`).
  - `SELL`: se valida que el usuario posea tenencia suficiente de ese instrumento (`positions[instrumentId] >= cantidad`).
- Si los recursos son insuficientes, la orden se considera rechazada por el mercado, **se persiste** con estado `REJECTED` y devuelve `201 Created` informando el rechazo como auditoría operativa.
- Si los recursos son suficientes:
  - Una orden `MARKET` se ejecuta inmediatamente y se persiste con estado `FILLED`.
  - Una orden `LIMIT` se persiste con estado `NEW`. No reserva recursos a futuro bajo los supuestos actuales.

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
| Parámetros inválidos o exclusión size/amount | `400`  | `INVALID_REQUEST`         |
| Usuario no encontrado                        | `404`  | `NOT_FOUND`               |
| Instrumento no encontrado                    | `404`  | `NOT_FOUND`               |
| Instrumento existente no negociable          | `422`  | `INSTRUMENT_NOT_TRADABLE` |
| Orden resulta en 0 acciones o inválida       | `422`  | `INVALID_ORDER`           |
| Cotización ausente para orden MARKET         | `500`  | `MARKET_DATA_UNAVAILABLE` |
| Fallo técnico inesperado                     | `500`  | `INTERNAL_ERROR`          |

## Persistencia y verificaciones

Se comprobó la búsqueda compilada y se revisó su SQL: una consulta, cuatro columnas, filtro de tipo, búsqueda parametrizada y límite/offset. Se inspeccionó el esquema remoto mediante lecturas y se alineó la nulabilidad de las cuatro entidades, sin modificar tablas ni datos.

Las pruebas HTTP usan PostgreSQL local aislado: comprueban búsqueda por ambos campos, orden y páginas, ausencia de resultados, campos nulos, exclusión de moneda y tipo nulo, un comodín literal y casos representativos de entradas inválidas y errores técnicos. Crean y eliminan sus propios instrumentos. No hay un fixture con un tipo desconocido explícito ni una prueba automatizada propia del esquema Swagger.

No se midió performance ni se agregaron índices de búsqueda. La decisión de postergar `pg_trgm` se explica en [supuestos y decisiones](../assumptions.md#búsqueda-e-índices).

Portfolio tiene cinco tests de cálculo y cinco HTTP sin PostgreSQL: promedio móvil y precisión, cierre/reapertura, sobreventa, precio ausente, contrato completo del seed y warning, cuenta vacía/inexistente, validación y errores controlados/sanitizados. Su adaptador usa `REPEATABLE READ` y `READ ONLY`, con el mismo manager y lecturas por lote; no hay consultas por posición.

Órdenes tiene pruebas del dominio y del contrato HTTP sin PostgreSQL. El test funcional aislado crea sus propios usuarios, instrumentos, cotización y transferencias: comprueba una MARKET persistida, dos compras simultáneas sobre el mismo saldo —una `FILLED` y otra `REJECTED`— y el rechazo sin persistencia de un instrumento `MONEDA`. Los fixtures se eliminan al terminar.

La API compilada se comprobó contra la base proporcionada, únicamente con GET: usuario 1 (`200`, total `889756.00`), usuario 2 vacío (`200`), usuario inexistente (`404`) e ID inválido (`400`, sin consultar la base). Se revisaron Swagger y las sentencias de la transacción: cuatro SELECT para la cuenta con posiciones, dos para la vacía y uno para el usuario inexistente. No se modificaron datos ni se midió performance. Esa comprobación fue anterior a mover la consulta de existencia al caso de uso; ahora se hace antes del snapshot financiero, sin sumar SELECT, y el refactor se verifica con mocks, no contra PostgreSQL.
