# Base de datos

PostgreSQL contiene usuarios, instrumentos, movimientos y precios de mercado. El [SQL provisto](database.sql) crea las cuatro tablas y carga los datos de referencia.

## Conexión

La API lee `DATABASE_URL` desde el entorno o `.env`. Se puede usar PostgreSQL local, cargado con el dump, o la base Neon provista. El [archivo de ejemplo](../.env.example) contiene los valores locales y un formato para la conexión a Neon.

La base Neon ya contiene los datos iniciales y no necesita que se importe el dump. Se inspeccionaron mediante consultas de solo lectura sus columnas, nulabilidad, claves e índices, que coinciden con el esquema funcional del SQL provisto. La configuración mantiene `synchronize: false`. El esquema adicional se entrega mediante migraciones explícitas y no se corrigen los datos originales.

| Variable       | Valor o validación                                     |
| -------------- | ------------------------------------------------------ |
| `DATABASE_URL` | Obligatoria. URL PostgreSQL con host y nombre de base. |
| `NODE_ENV`     | `development` (predeterminado), `test` o `production`. |
| `PORT`         | Entero entre 1 y 65535. Predeterminado `3000`.         |

El entorno prevalece sobre `.env`. En tests no se carga ese archivo. Host, puerto y credenciales se especifican en la URL, sin parámetros alternativos que cambien el destino. La API cierra sus conexiones al recibir `SIGINT` o `SIGTERM`.

### TLS y conexión

`sslmode=verify-full` verifica certificado y hostname. `require` se normaliza a `verify-full`. Sin modo explícito, las conexiones a loopback usan `disable` y las demás `verify-full`. Un servidor local sin TLS en otro hostname requiere `sslmode=disable` explícito. No se usa `rejectUnauthorized: false`.

La configuración mantiene TLS en la URL porque [`pg` permite que sus parámetros reemplacen las opciones SSL del driver](https://node-postgres.com/features/ssl). Se rechazan los parámetros alternativos `ssl` y `uselibpqcompat` para evitar configuraciones contradictorias. El driver habilita channel binding cuando el servidor lo ofrece. No se afirma que el parámetro de URL `channel_binding=require` lo fuerce.

El pool tiene hasta 10 conexiones por proceso y un timeout de conexión de 5 segundos. Nest realiza hasta 3 intentos de conexión, separados por 1 segundo. Las migraciones no se ejecutan al iniciar la API.

El logging de errores de consultas TypeORM está deshabilitado porque incluye SQL y parámetros. El filtro HTTP registra un mensaje genérico ante fallos inesperados. El diagnóstico interno con información sanitizada sigue pendiente.

## Preparar una base local

Con Docker y Compose, desde la raíz del proyecto:

```bash
npm run db:up
```

El servicio utiliza PostgreSQL 17, puerto `127.0.0.1:5432`, usuario/contraseña `poc` y base `neondb`. Compose espera a que PostgreSQL esté disponible y carga el seed solo al inicializar un volumen vacío. Los datos persisten al detener los servicios con `npm run db:down`. Modificar el SQL no vuelve a cargar un volumen existente.

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

| Tema                | Consideración                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombres físicos     | PostgreSQL crea `userid`, `instrumentid`, `accountnumber` y `previousclose` en minúsculas.                                                                                              |
| Fecha de mercado    | La columna de cotizaciones es `marketdata.date`.                                                                                                                                        |
| Precios             | `NUMERIC(10,2)` se mantiene como string en las entidades y se convierte a `Money` para calcular.                                                                                        |
| Nulabilidad         | El SQL permite `NULL` fuera de la clave primaria. Las cuatro entidades están alineadas y la aplicación valida los campos necesarios para calcular, sin agregar restricciones a la base. |
| Cotizaciones        | Los datos corresponden al 13 y 14 de julio de 2023. Seleccionar el último registro disponible por instrumento.                                                                          |
| Historial ejecutado | Hay una orden LIMIT histórica `FILLED` que debe contar al reconstruir recursos.                                                                                                         |
| Tenencia negativa   | Usuario 1, instrumento 31 (BMA): compra de 20 y venta de 30 ejecutadas, con saldo de −10 acciones. Conservar y documentar la anomalía.                                                  |

## Migraciones y mejoras

El [DataSource de migraciones](../src/shared/infrastructure/persistence/data-source.ts) comparte configuración y entidades con la API. Las migraciones incrementales se registran explícitamente en `database.options.ts`. No se ejecutan al iniciar la aplicación.

La [migración de idempotencia](../src/shared/infrastructure/persistence/migrations/1791374400000-create-idempotency-records.ts) crea `idempotency_records` con `varchar` para operación, alcance y hash, y `uuid` para la clave. También guarda código HTTP, resultado JSON y fecha. `UNIQUE (operation, scope, key)` arbitra reintentos concurrentes sin acoplar el esquema a `orders`. Para órdenes, el alcance identifica al usuario. Una restricción exige que código y resultado estén ambos pendientes o ambos completos. La migración inversa elimina la tabla. Una fila sin resultado confirmado solo existe dentro de la transacción activa.

| Comando                    | Acción                                         |
| -------------------------- | ---------------------------------------------- |
| `npm run migration:show`   | Compilar y consultar el estado de migraciones. |
| `npm run migration:run`    | Compilar y aplicar las pendientes.             |
| `npm run migration:revert` | Compilar y revertir la última aplicada.        |

Los comandos usan `DATABASE_URL` del entorno o `.env`. Antes de aplicar, revisar el destino con `migration:show`. Para elegir la base local explícitamente:

```bash
DATABASE_URL='postgresql://poc:poc@127.0.0.1:5432/neondb?sslmode=disable' npm run migration:show
```

El seed crea el esquema inicial únicamente en la base local. Las migraciones parten del esquema existente y no recrean las cuatro tablas originales ni recargan datos. Revisar SQL y destino antes de aplicarlas a la base proporcionada.

No se conservó ninguna migración de índices de performance. Las consultas de órdenes ejecutadas y últimas cotizaciones se compararon con y sin índices en la base local. PostgreSQL mantuvo los recorridos secuenciales con el volumen actual. La medición, sus límites y el criterio para revisarlo si crecen los datos están en [supuestos y decisiones](../docs/assumptions.md#índices-de-órdenes-y-cotizaciones). La búsqueda por subcadena tampoco incorpora `pg_trgm`. La decisión se explica en la [misma guía](../docs/assumptions.md#búsqueda-e-índices). La restricción única de idempotencia se conserva porque garantiza corrección, no como optimización de estas consultas.

## Base de pruebas

```bash
npm run db:up:test
npm run test:e2e
```

`postgres-test` usa otro volumen, el puerto `127.0.0.1:5433` y la base `cocos_test`, inicializada con el mismo seed. La configuración e2e fija `NODE_ENV=test` y su URL, sin leer `.env` ni reutilizar `DATABASE_URL` de la API.

Para otra base local, exportar `TEST_DATABASE_URL` en la shell. Solo se admiten hosts loopback y nombres de base terminados en `_test`. No se admiten bases remotas. Las pruebas de órdenes preparan y limpian sus propios datos sin depender de escrituras de otra prueba.

Los tests de integración de órdenes aplican las migraciones pendientes sobre `cocos_test` antes de preparar sus fixtures. Nunca deben ejecutarse contra la base remota ni contra una base local que no termine en `_test`.
