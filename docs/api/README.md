# Contrato HTTP

Swagger está disponible en `/api/docs`. El archivo [REST Client](cocos-capital.http) contiene las solicitudes para probar la API y utiliza el puerto local predeterminado. Los [pasos de preparación](../../README.md#ejecutar-el-proyecto) y [uso de la API](../../README.md#probar-la-api) se mantienen en el README central. Búsqueda y health están implementados. Órdenes y portfolio siguen pendientes.

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

## Errores HTTP

El filtro compartido presenta las excepciones como Problem Details, con `Content-Type: application/problem+json`.

| Situación                               | Estado                 | Código            |
| --------------------------------------- | ---------------------- | ----------------- |
| Solicitud inválida                      | `400`                  | `INVALID_REQUEST` |
| Ruta o recurso inexistente              | `404`                  | `NOT_FOUND`       |
| Otras excepciones HTTP anteriores a 500 | Estado de la excepción | `HTTP_ERROR`      |
| Fallo técnico inesperado                | `500`                  | `INTERNAL_ERROR`  |

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

`instance` identifica el path, sin query string. Las excepciones de servidor devuelven un detalle genérico y no publican información de PostgreSQL. El log actual registra un mensaje genérico; un diagnóstico interno más detallado queda pendiente. Health conserva su respuesta propia para indicar disponibilidad, incluido su `503`.

Los códigos de negocio de órdenes y portfolio se definirán con sus contratos. Una orden financiera `REJECTED` tendrá su respuesta de negocio, según los [supuestos](../assumptions.md).

## Persistencia y verificaciones

Se comprobó la API compilada y se revisó su SQL: una consulta de lectura por búsqueda, cuatro columnas, filtro de tipo, parámetro de búsqueda y límite/offset en PostgreSQL. Se alineó la nulabilidad de `InstrumentEntity` con el SQL local, sin cambiar el esquema. La equivalencia remota permanece pendiente.

Las pruebas HTTP usan PostgreSQL local aislado: comprueban búsqueda por ambos campos, orden y páginas, ausencia de resultados, campos nulos, exclusión de moneda y tipo nulo, un comodín literal y casos representativos de entradas inválidas y errores técnicos. Crean y eliminan sus propios instrumentos. No hay un fixture con un tipo desconocido explícito ni una prueba automatizada propia del esquema Swagger.

No se midió performance ni se agregaron índices de búsqueda. La decisión de postergar `pg_trgm` se explica en [supuestos y decisiones](../assumptions.md#búsqueda-e-índices).
