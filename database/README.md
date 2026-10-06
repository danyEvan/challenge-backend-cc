# Base de datos

PostgreSQL contiene usuarios, instrumentos, movimientos y precios de mercado. El [SQL provisto](database.sql) crea las cuatro tablas y carga los datos de referencia.

## Conexión

La API lee `DATABASE_URL` desde el entorno o `.env`. El [archivo de ejemplo](../.env.example) contiene valores locales y un formato para completar la conexión remota.

La base hosteada proporcionada ya contiene datos. La equivalencia de su esquema con el script local todavía está pendiente de verificar. La configuración de TypeORM mantiene `synchronize: false`.

| Variable       | Valor o validación                                     |
| -------------- | ------------------------------------------------------ |
| `DATABASE_URL` | Obligatoria; URL PostgreSQL con host y nombre de base. |
| `NODE_ENV`     | `development` (predeterminado), `test` o `production`. |
| `PORT`         | Entero entre 1 y 65535; predeterminado `3000`.         |

El entorno prevalece sobre `.env`. En tests no se carga ese archivo. Host, puerto y credenciales se especifican en la URL, sin parámetros alternativos que cambien el destino. La API cierra sus conexiones al recibir `SIGINT` o `SIGTERM`.

### TLS y conexión

`sslmode=verify-full` verifica certificado y hostname. `require` se normaliza a `verify-full`; sin modo explícito, conexiones a loopback usan `disable` y las demás `verify-full`. Un servidor local sin TLS en otro hostname requiere `sslmode=disable` explícito. No se usa `rejectUnauthorized: false`.

La configuración mantiene TLS en la URL porque [`pg` permite que sus parámetros reemplacen las opciones SSL del driver](https://node-postgres.com/features/ssl). Se rechazan los parámetros alternativos `ssl` y `uselibpqcompat` para evitar configuraciones contradictorias. El driver habilita channel binding cuando el servidor lo ofrece; no se afirma que el parámetro de URL `channel_binding=require` lo fuerce.

El pool tiene hasta 10 conexiones por proceso y un timeout de conexión de 5 segundos. Nest realiza hasta 3 intentos de conexión, separados por 1 segundo. Las migraciones no se ejecutan al iniciar la API.

El logging de errores de consultas TypeORM está deshabilitado porque incluye SQL y parámetros. El filtro HTTP registra un mensaje genérico ante fallos inesperados; el diagnóstico interno con información sanitizada sigue pendiente.

## Preparar una base local

Con Docker y Compose, desde la raíz del proyecto:

```bash
npm run db:up
```

El servicio utiliza PostgreSQL 17, puerto `127.0.0.1:5432`, usuario/contraseña `poc` y base `neondb`. Compose espera a que PostgreSQL esté disponible y carga el seed solo al inicializar un volumen vacío. Los datos persisten al detener los servicios con `npm run db:down`; modificar el SQL no vuelve a cargar un volumen existente.

Si `5432` ya está ocupado, configurar otro `POSTGRES_PORT` en `.env` y ajustar el puerto de `DATABASE_URL` para que coincidan. También se puede iniciar una vez con `POSTGRES_PORT=5434 npm run db:up` y pasar esa URL explícitamente a la API o al CLI.

### Alternativa manual

Para utilizar los valores locales de `.env.example`, preparar un usuario `poc` con contraseña `poc` y una base vacía `neondb` en `localhost:5432`. El usuario debe tener permiso para crear tablas en esa base.

Desde la raíz del proyecto, con el cliente `psql` instalado:

```bash
psql --dbname='postgresql://poc:poc@localhost:5432/neondb' --set=ON_ERROR_STOP=1 --single-transaction --file=database/database.sql
```

Estos son datos de conexión de ejemplo para el entorno local. Ajustarlos si la instancia utiliza otros valores.

El script requiere una base vacía: crea tablas e inserta datos, y no admite ejecuciones repetidas sobre el mismo esquema. Usar únicamente la base local para cargar el seed.

## Particularidades del esquema y el seed

| Tema                | Consideración                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombres físicos     | PostgreSQL crea `userid`, `instrumentid`, `accountnumber` y `previousclose` en minúsculas.                                                                                                                 |
| Fecha de mercado    | La columna de cotizaciones es `marketdata.date`.                                                                                                                                                           |
| Precios             | `NUMERIC(10,2)` se mantiene como string en las entidades y se convierte a `Money` para calcular.                                                                                                           |
| Nulabilidad         | El SQL permite `NULL` en las columnas distintas de la clave primaria. `InstrumentEntity` y `UserEntity` están alineadas; `OrderEntity` y `MarketDataEntity` siguen pendientes de completar esa alineación. |
| Cotizaciones        | Los datos corresponden al 13 y 14 de julio de 2023. Seleccionar el último registro disponible por instrumento.                                                                                             |
| Historial ejecutado | Hay una orden LIMIT histórica `FILLED`; debe contar al reconstruir recursos.                                                                                                                               |
| Tenencia negativa   | Usuario 1, instrumento 31 (BMA): compra de 20 y venta de 30 ejecutadas, con saldo de −10 acciones. Conservar y documentar la anomalía.                                                                     |

## Migraciones y mejoras

El [DataSource de migraciones](../src/shared/infrastructure/persistence/data-source.ts) comparte configuración y entidades con la API. Las migraciones incrementales se escribirán en `src/shared/infrastructure/persistence/migrations/`; todavía no hay cambios de esquema aprobados por mediciones.

| Comando                    | Acción                                         |
| -------------------------- | ---------------------------------------------- |
| `npm run migration:show`   | Compilar y consultar el estado de migraciones. |
| `npm run migration:run`    | Compilar y aplicar las pendientes.             |
| `npm run migration:revert` | Compilar y revertir la última aplicada.        |

Los comandos usan `DATABASE_URL` del entorno o `.env`. Para elegir la base local explícitamente:

```bash
DATABASE_URL='postgresql://poc:poc@127.0.0.1:5432/neondb?sslmode=disable' npm run migration:show
```

El seed crea el esquema inicial únicamente en la base local. Las migraciones futuras parten del esquema existente; no recrean tablas ni recargan datos. Revisar SQL y destino antes de aplicarlas a la base proporcionada.

Antes de preparar una migración, comprobar los índices existentes y medir la consulta que se busca mejorar. Los candidatos actuales son:

| Consulta                                                   | Índice candidato                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Movimientos ejecutados de un usuario, en orden cronológico | `orders (userid, status, datetime, id)`                    |
| Última cotización por instrumento                          | `marketdata (instrumentid, date DESC NULLS LAST, id DESC)` |

Para la búsqueda por subcadena se consideró `pg_trgm`, pero no se incorporó al catálogo actual. La justificación y el criterio para retomarlo están en [supuestos y decisiones](../docs/assumptions.md#búsqueda-e-índices).

Estas propuestas aún no se implementaron ni midieron. Registrar comparaciones, costo de escrituras y almacenamiento en [docs/evidence](../docs/evidence/README.md), y documentar la aplicación y reversión de cada migración aceptada.

## Base de pruebas

```bash
npm run db:up:test
npm run test:e2e
```

`postgres-test` usa otro volumen, el puerto `127.0.0.1:5433` y la base `cocos_test`, inicializada con el mismo seed. La configuración e2e fija `NODE_ENV=test` y su URL, sin leer `.env` ni reutilizar `DATABASE_URL` de la API.

Para otra base local, exportar `TEST_DATABASE_URL` en la shell. Solo se admiten hosts loopback y nombres de base terminados en `_test`; no se admiten bases remotas. Las futuras pruebas de órdenes deberán preparar y limpiar sus propios datos sin depender de escrituras de otra prueba.

Se comprobó el arranque de ambos PostgreSQL, la conexión de la API compilada y el CLI `migration:show` contra la base local. Pasaron los e2e de health y búsqueda, incluyendo fixtures propios que se eliminan al terminar. El test funcional de órdenes sigue pendiente; no se verificó ni modificó la base remota.
