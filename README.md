# Cocos Capital · Backend Challenge

<p align="center">
  <img src="docs/pictures/cocos.jpg" alt="Cocos Capital" width="220" />
</p>

API REST de inversiones desarrollada con Node.js, NestJS, TypeScript y PostgreSQL.

## Alcance y estado

| Funcionalidad       | Alcance                                                          | Estado       |
| ------------------- | ---------------------------------------------------------------- | ------------ |
| Buscar instrumentos | Coincidencias por ticker o nombre, con paginación.               | Implementado |
| Enviar órdenes      | BUY/SELL, MARKET/LIMIT, cantidad o monto y rechazos persistidos. | Implementado |
| Consultar portfolio | Efectivo, valor total, posiciones y rendimiento.                 | Implementado |
| Health              | Disponibilidad de la API y PostgreSQL.                           | Implementado |

También están implementados los cálculos compartidos de dinero, efectivo, tenencias y el test funcional de envío de órdenes.

## Ejecutar el proyecto

Requisitos: Node.js 24 y npm. Desde la raíz del proyecto:

```bash
npm ci
test -f .env || cp .env.example .env
```

El comando conserva `.env` si ya existe. Elegir una de estas opciones para la base:

- **Base de datos en la nube:** configurar `DATABASE_URL` en `.env` con la conexión a PostgreSQL y los datos del challenge ya cargados. No requiere Docker.
- **Base de datos local:** usar los valores locales de `.env.example` y ejecutar el siguiente comando. Requiere Docker con Compose.

```bash
npm run db:up
```

Compose carga [database.sql](database/database.sql) al crear el volumen por primera vez y conserva sus datos al detenerlo. Si `5432` está ocupado, ajustar `POSTGRES_PORT` y el puerto de `DATABASE_URL` en `.env` para que coincidan.

Con la base configurada, iniciar la API:

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000`. Para ejecutar la versión compilada, usar `npm run build && npm run start:prod`.

## Probar la API

Las solicitudes están preparadas en [cocos-capital.http](docs/api/cocos-capital.http):

1. Instalar la extensión [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) en VS Code y abrir el archivo.
2. Pulsar **Send Request** sobre `Application and database readiness - 200` para comprobar que la API y la base estén disponibles.
3. Ejecutar `Search by ticker - 200`. Con los datos provistos, devuelve GGAL (id 34) en `data`.
4. Ejecutar `User portfolio - 200`: el usuario 1 tiene efectivo `753000.00` y valor total `889756.00`, incluyendo la posición heredada de BMA de −10 acciones.
5. Recorrer los demás casos de búsqueda y portfolio, incluidas respuestas vacías y errores intencionales.
6. Para probar órdenes, usar una base local descartable: las solicitudes `POST /orders` crean movimientos y cambian los portfolios posteriores.

El archivo define `baseUrl=http://localhost:3000`; ajustar ese valor si cambia el puerto de la API. No se requiere autenticación.

Como alternativa desde el navegador, abrir [Swagger](http://localhost:3000/api/docs) y usar **Try it out**. El [contrato HTTP](docs/api/README.md) detalla parámetros, respuestas y errores.

La búsqueda acepta `search`, `limit` (20 por defecto) y `offset` (0 por defecto). Devuelve `{ data, meta }`; sin coincidencias responde `200` con `data: []`.

`GET /users/:userId/portfolio` devuelve `{ data }`, sin paginación. Importes y porcentajes son strings de dos decimales; el costo y rendimiento no reconstruibles son `null`.

## Ejecutar las verificaciones

```bash
# Suites rápidas por responsabilidad.
npm run test:unit
npm run test:feature

# Integración HTTP con PostgreSQL local aislado.
npm run test:integration

# Formato, tipos, lint, pruebas sin base de datos y build.
npm run verify

# Verificación anterior más pruebas HTTP/e2e contra PostgreSQL aislado.
npm run verify:all
```

Las pruebas están separadas en `test/unit`, `test/feature` y `test/integration`. `test:e2e` se conserva como alias de `test:integration`.

`test:integration` y `verify:all` requieren PostgreSQL local aislado. `verify:all` lo inicia con Docker Compose (`cocos_test`, puerto `5433`). Los e2e crean y eliminan fixtures allí; no usan `.env` ni la base proporcionada. Para detener los servicios locales conservando sus datos, ejecutar `npm run db:down`.

Las pruebas sin base cubren dinero, recursos, dominio y contrato HTTP de órdenes, portfolio, health y búsqueda. `verify:all` agrega pruebas funcionales de búsqueda y órdenes contra PostgreSQL aislado, incluida la persistencia de un rechazo concurrente. El detalle y los límites están en el [contrato HTTP](docs/api/README.md#persistencia-y-verificaciones).

## Diseño y decisiones

Monolito modular con separación de HTTP, aplicación, dominio y persistencia:

```mermaid
flowchart LR
    HTTP["Controller HTTP"] --> UseCase["Caso de uso"]
    UseCase --> Port["Puerto de aplicación"]
    Adapter["Adaptador TypeORM"] -. implementa .-> Port
    Adapter --> Database[(PostgreSQL)]
    UseCase --> Domain["Dominio financiero"]
```

- `instruments`: búsqueda del catálogo negociable.
- `orders`: validación y persistencia de órdenes.
- `portfolio`: reconstrucción, valuación y rendimiento.
- `shared`: dinero, recursos, lecturas de usuarios y mercado, persistencia y errores HTTP reutilizados.

Los controllers y DTOs pertenecen a infraestructura; los casos de uso y el dominio no dependen de NestJS ni TypeORM. La [guía de arquitectura](docs/architecture.md) contiene el árbol completo, los límites entre módulos y la estrategia de consistencia.

| Decisión implementada                             | Motivo                                                          |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Catálogo limitado a `ACCIONES`                    | `MONEDA` representa el efectivo de la cuenta.                   |
| Búsqueda parametrizada y ordenada por ticker e id | Tratar el texto como dato y desempatar resultados paginados.    |
| Cálculos compartidos con `decimal.js`             | Conservar precisión monetaria y redondear al presentar.         |
| Recursos reconstruidos desde movimientos `FILLED` | Separar operaciones ejecutadas de pendientes y rechazos.        |
| Errores HTTP con Problem Details                  | Mantener un formato común sin exponer detalles de persistencia. |
| Portfolio con snapshot de solo lectura            | Evitar mezclar movimientos y cotizaciones de distintos estados. |
| Órdenes atómicas con bloqueo por usuario          | Evitar que solicitudes simultáneas consuman el mismo recurso.   |

Los criterios financieros y las decisiones de órdenes están en [supuestos funcionales](docs/assumptions.md). La transacción usa el mismo manager para bloquear la cuenta, reconstruir recursos y persistir el resultado.

## Documentación técnica

| Documento                                            | Contenido                                  |
| ---------------------------------------------------- | ------------------------------------------ |
| [Contrato HTTP](docs/api/README.md)                  | Rutas, validaciones, respuestas y errores. |
| [Supuestos funcionales](docs/assumptions.md)         | Decisiones financieras y pendientes.       |
| [PostgreSQL](database/README.md)                     | Entorno local, esquema, TLS y migraciones. |
| [Dominio compartido](src/shared/README.md)           | Dinero, recursos y cotizaciones.           |
| [Evidencias de performance](docs/evidence/README.md) | Procedimiento y resultados de mediciones.  |

Las variables se validan al iniciar y las migraciones se ejecutan mediante comandos explícitos. No hay mediciones de performance publicadas todavía.
