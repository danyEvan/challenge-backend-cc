# Cocos Capital · Backend Challenge

<p align="center">
  <img src="docs/pictures/cocos.jpg" alt="Logo de Cocos Capital" width="220" />
</p>

API REST de inversiones para buscar instrumentos, enviar órdenes y consultar el portfolio de un usuario. Desarrollada con Node.js, NestJS, TypeScript y PostgreSQL.

**Estado:** en desarrollo. La infraestructura y los cálculos compartidos están implementados; los tres endpoints de negocio están pendientes.

## Alcance y estado

| Funcionalidad            | Alcance                                                                 | Estado       |
| ------------------------ | ----------------------------------------------------------------------- | ------------ |
| Búsqueda de instrumentos | Coincidencias por ticker y/o nombre.                                    | Pendiente    |
| Envío de órdenes         | BUY/SELL, MARKET/LIMIT, cantidad o monto en ARS y registro de rechazos. | Pendiente    |
| Portfolio                | Efectivo disponible, valor total, posiciones y rendimiento.             | Pendiente    |
| Health                   | Disponibilidad de la aplicación y su conexión a PostgreSQL.             | Implementado |

La base actual incluye precisión monetaria con `decimal.js`, reconstrucción de recursos desde movimientos ejecutados, lecturas de cotizaciones y tests unitarios de dinero, recursos y health.

La entrega debe incluir ejecución local reproducible, test funcional de envío de órdenes y decisiones documentadas.

## Stack

| Área          | Herramientas                            |
| ------------- | --------------------------------------- |
| API           | NestJS y TypeScript estricto            |
| Persistencia  | PostgreSQL, TypeORM y `pg`              |
| Dinero        | `decimal.js`                            |
| Validación    | `class-validator` y `class-transformer` |
| Pruebas       | Vitest, Nest Testing y Supertest        |
| Contrato HTTP | Swagger / OpenAPI                       |

## Ejecución local

### Requisitos

- Node.js 24, la versión utilizada por el Dockerfile, y npm.
- Docker con Compose para PostgreSQL local, o una instancia PostgreSQL accesible con los datos del challenge.

### Preparación

Desde la raíz del proyecto:

```bash
npm ci
cp .env.example .env
npm run db:up
```

Configurar `DATABASE_URL` en `.env` para la base elegida. El archivo de ejemplo también incluye `PORT` y `NODE_ENV`.

Compose prepara PostgreSQL local y carga el seed al crear su volumen. Si se utiliza la base proporcionada, configurar su URL y omitir `db:up`: esa base ya tiene datos. La [guía de PostgreSQL](database/README.md) explica TLS, migraciones y la base de pruebas. El Dockerfile contiene la API.

Las variables se validan al arrancar. Las conexiones remotas usan TLS por defecto, verificando el certificado; las migraciones se ejecutan mediante comandos explícitos.

### Iniciar la API

```bash
npm run start:dev
```

Con el puerto predeterminado:

| Recurso | Dirección                                                        |
| ------- | ---------------------------------------------------------------- |
| Health  | [http://localhost:3000/health](http://localhost:3000/health)     |
| Swagger | [http://localhost:3000/api/docs](http://localhost:3000/api/docs) |

Swagger mostrará los endpoints de negocio a medida que se implementen.

Para ejecutar el código compilado:

```bash
npm run build
npm run start:prod
```

## Verificaciones

| Acción                  | Comando                                                 | Base de datos |
| ----------------------- | ------------------------------------------------------- | ------------- |
| Tipos, incluyendo tests | `npx tsc --noEmit --incremental false -p tsconfig.json` | No            |
| Lint                    | `npm run lint`                                          | No            |
| Build                   | `npm run build`                                         | No            |
| Tests unitarios         | `npm test`                                              | No            |
| Tests HTTP/e2e          | `npm run test:e2e`                                      | Sí            |

Antes de ejecutar e2e, iniciar la base aislada con `npm run db:up:test`. Estas pruebas usan `cocos_test` en el puerto `5433`, sin leer `.env`; el e2e existente cubre health. El test funcional de órdenes está pendiente.

## Organización

Monolito modular con separación liviana de dominio, aplicación e infraestructura.

```text
src/
├── instruments/  # Búsqueda de activos
├── orders/       # Creación y ejecución de órdenes
├── portfolio/    # Valuación y rendimiento
├── shared/       # Dinero, recursos y persistencia reutilizados
└── health/       # Disponibilidad
```

La [guía de arquitectura](docs/architecture.md) explica los límites entre módulos. Las decisiones financieras se documentan en [supuestos](docs/assumptions.md).

## Documentación

| Documento                                            | Contenido                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [Índice técnico](docs/README.md)                     | Organización de la documentación y cuándo actualizarla.          |
| [Arquitectura](docs/architecture.md)                 | Responsabilidades y estrategia de consistencia.                  |
| [Supuestos funcionales](docs/assumptions.md)         | Criterios financieros, motivos y decisiones pendientes.          |
| [Base de datos](database/README.md)                  | Preparación local, particularidades del seed y migraciones.      |
| [Evidencias de performance](docs/evidence/README.md) | Comparaciones, capturas, consultas y procedimientos de medición. |
| [Elementos compartidos](src/shared/README.md)        | Comportamiento de dinero, recursos y lecturas comunes.           |
| [Guía para agentes](AGENTS.md)                       | Convenciones y contexto para continuar el desarrollo.            |
