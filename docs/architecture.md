# Arquitectura

## Enfoque

Monolito modular con arquitectura hexagonal liviana. El dominio es independiente de NestJS y TypeORM; cada funcionalidad reúne sus casos de uso y adaptadores.

El [README](../README.md) identifica las funcionalidades implementadas y pendientes. Los criterios financieros están en [supuestos y decisiones funcionales](assumptions.md).

| Parte           | Responsabilidad                                                     |
| --------------- | ------------------------------------------------------------------- |
| Dominio         | Reglas y cálculos financieros.                                      |
| Aplicación      | Casos de uso y puertos para acceder a datos.                        |
| Infraestructura | HTTP, TypeORM y conexión de implementaciones mediante módulos Nest. |

```text
Caso de uso → puerto TradingRepository
                       ↑
             adaptador TypeORM
```

`TradingRepository` es una clase abstracta y un token de inyección. `TradingTypeOrmRepository` transforma resultados de TypeORM en modelos independientes del ORM.

La búsqueda usa su puerto propio `InstrumentSearchRepository`: controller HTTP → `SearchInstruments` → puerto → `InstrumentSearchTypeOrmRepository`. El módulo Nest construye el caso de uso mediante una factory; la aplicación conserva independencia del framework. Dentro de `instruments`, `InstrumentSearchItem`, `InstrumentSearchCriteria` e `InstrumentSearchPage` son contratos del caso de uso y se ubican en `application/interfaces/`. No se crea un modelo de dominio para una consulta sin reglas propias.

Los DTOs están en `infrastructure/http/dto/`, el controller en `infrastructure/http/controllers/`, las transformaciones HTTP en `infrastructure/http/transforms/` y el adaptador en `infrastructure/persistence/`. El puerto abstracto de lectura queda en `application/ports/`: expresa la dependencia del caso de uso y también funciona como token de inyección en runtime.

El filtro HTTP de Problem Details pertenece a `shared/infrastructure/http/` y se registra al configurar la aplicación. El controller de búsqueda traduce `{ items, limit, offset }` de aplicación a `{ data, meta: { limit, offset } }` en su DTO de salida. Este formato HTTP queda definido en los [contratos](api/README.md).

## Legibilidad y simplicidad

Clean Code, DRY y KISS se usan como criterios de revisión, no como reglas mecánicas:

- Legibilidad: nombres con intención, responsabilidades claras y etapas visibles del flujo. Menos líneas no implica código más fácil de explicar.
- DRY: una interpretación compartida de las reglas financieras. Código parecido de responsabilidades distintas no exige una abstracción común.
- KISS: resolver el alcance actual con las dependencias necesarias, sin anticipar extensiones ni fragmentar métodos por tamaño.

Una simplificación debe conservar contratos, precisión y consistencia. La [regla de calidad de código](../.agents/rules/code-quality.md) indica cómo aplicar estos criterios al modificar código y pruebas.

## Estructura de cada feature

La estructura de `instruments` sirve como referencia para `portfolio` y `orders`:

```text
src/<feature>/
  domain/                     # reglas y modelos de negocio, si existen
  application/
    interfaces/               # entradas, resultados y proyecciones
    ports/                    # dependencias que necesita cada caso de uso
    usecases/                 # orquestación sin NestJS ni TypeORM
  infrastructure/
    http/
      controllers/            # rutas y delegación al caso de uso
      dto/                    # validación de entrada y esquema de salida
      filters/                # traducción de errores de la feature, si hace falta
      transforms/             # auxiliares HTTP reutilizables, si hacen falta
    persistence/              # adaptadores TypeORM y mapeo hacia datos de dominio
  <feature>.module.ts         # conexión de providers, puertos y controllers
```

El controller recibe y devuelve DTOs HTTP; el caso de uso trabaja con contratos sin decoradores ni dependencias del framework. Los puertos pertenecen a aplicación porque expresan qué necesita el caso de uso; el módulo Nest conecta cada puerto con su adaptador. `domain/` se reserva para reglas, entidades y valores propios del negocio: una feature sin lógica de dominio puede no usarlo. Las entidades TypeORM compartidas permanecen en `shared/infrastructure/persistence/entities/`. Crear subcarpetas opcionales solo cuando contengan código; cada contrato, DTO, caso de uso y adaptador tiene su propio archivo. Las pruebas unitarias se ubican junto al código y las HTTP/e2e en `test/`.

Los contratos de persistencia usan una clase abstracta `<Nombre>Repository` en `application/ports/<nombre>.repository.ts`, sin dependencias de NestJS ni TypeORM. Su implementación se llama `<Nombre>TypeOrmRepository` y vive en `infrastructure/persistence/<nombre>-typeorm.repository.ts`. El módulo Nest registra el contrato con `provide` y la implementación con `useClass` o `useFactory`. La clase abstracta sirve como tipo y como token de inyección; no requiere un token adicional. Cada contrato declara únicamente las operaciones necesarias para sus consumidores, sin agregar un repositorio genérico ni métodos CRUD sin uso.

El dominio compartido implementa dinero y reconstrucción de recursos. `portfolio/domain/` agrega promedio ponderado móvil, valuación y rendimiento; `orders` todavía está pendiente. `instruments` es una consulta sin reglas de dominio propias. Su adaptador incluye únicamente `ACCIONES`; las transferencias de `MONEDA` aportan efectivo.

El cálculo de portfolio separa la reconstrucción cronológica del costo y la valuación con cotizaciones. Rendimiento y variación diaria reutilizan la misma fórmula porcentual, con bases distintas; los helpers permanecen privados al cálculo, sin agregar capas.

Las excepciones de negocio extienden `Error`, sin dependencias HTTP. `InvalidAccountHistoryError` es compartida; portfolio define usuario inexistente y datos de valuación insuficientes. Un filtro propio de portfolio las traduce mediante `ApiProblemException` y reutiliza el filtro compartido para publicar únicamente detalles seguros. Los fallos inesperados permanecen sanitizados. El futuro rechazo financiero de una orden se persistirá como `REJECTED`, separado de un fallo técnico.

## Límites entre módulos

| Módulo        | Responsabilidad                                                              |
| ------------- | ---------------------------------------------------------------------------- |
| `instruments` | Búsqueda por ticker y nombre.                                                |
| `orders`      | Cantidad o monto, reglas MARKET/LIMIT, disponibilidad y creación de órdenes. |
| `portfolio`   | Costo de la posición, valuación y rendimiento.                               |
| `shared`      | Dinero, recursos, contratos de lectura y persistencia reutilizados.          |

Compartir la reconstrucción de recursos mantiene una interpretación común del historial. Los DTOs HTTP y casos de uso pertenecen a su feature.

Las cuatro entidades TypeORM mapean una base utilizada por varias funcionalidades y están centralizadas para reducir duplicación. Sus detalles permanecen en infraestructura.

`UserRepository`, en `shared/application/ports/`, declara la lectura `exists(userId)` y `UserTypeOrmRepository`, en infraestructura compartida, consulta `UserEntity`. `PortfolioModule` registra ese adaptador mediante una factory. `GetPortfolio` coordina la consulta y decide cómo tratar la ausencia del usuario; `PortfolioRepository` obtiene el snapshot financiero. `TradingRepository` se limita a movimientos y cotizaciones.

## Consistencia y concurrencia

La estrategia elegida para órdenes es una transacción con bloqueo de la fila del usuario antes de validar disponibilidad. Las lecturas y la escritura usarán el mismo manager; el rechazo financiero también se confirmará.

El bloqueo por usuario permitirá que cuentas distintas avancen independientemente. Portfolio ya usa una transacción `REPEATABLE READ`, con `SET TRANSACTION READ ONLY` antes de leer. `PortfolioTypeOrmRepository` crea el lector compartido con ese mismo manager: movimientos, instrumentos y cotizaciones pertenecen al mismo snapshot. Las dos últimas lecturas se hacen en lote y se omiten si no hay posiciones abiertas.

`GetPortfolio` consulta existencia mediante `UserRepository` y decide si lanzar `UserNotFoundError` antes de solicitar el snapshot. Esa consulta previa queda fuera de la transacción financiera: no garantiza atomicidad ante una eliminación concurrente del usuario. El challenge no incorpora un flujo de eliminación de usuarios.

El puerto `PortfolioRepository` entrega siempre un snapshot, incluso vacío, sin validar existencia ni filtrar entidades ORM hacia aplicación. `GetPortfolio` delega el cálculo al dominio y presenta strings decimales. El controller agrega `data` y registra posiciones negativas; la ruta pertenece a portfolio aunque consuma una lectura de usuarios.

La concurrencia de órdenes y las pruebas automatizadas de aislamiento con PostgreSQL siguen pendientes. La [guía de shared](../src/shared/README.md) explica la conexión al manager transaccional.

## Performance

Los candidatos de índices y cambios de esquema se mantienen en la [guía de PostgreSQL](../database/README.md). Las [evidencias](evidence/README.md) registrarán su evaluación y sus límites.
