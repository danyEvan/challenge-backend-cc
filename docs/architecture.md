# Arquitectura

## Enfoque

Monolito modular con arquitectura hexagonal liviana. El dominio es independiente de NestJS y TypeORM. Cada funcionalidad reúne sus casos de uso y adaptadores.

El [README](../README.md) identifica las funcionalidades implementadas y pendientes. Los criterios financieros están en [supuestos y decisiones funcionales](assumptions.md).

Los recorridos completos se representan en los [diagramas de casos de uso y secuencia](diagrams/README.md).

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

La búsqueda usa su puerto propio `InstrumentSearchRepository`: controller HTTP → `SearchInstruments` → puerto → `InstrumentSearchTypeOrmRepository`. El módulo Nest construye el caso de uso mediante una factory. La aplicación conserva independencia del framework. El adaptador busca y pagina instrumentos primero, luego carga en lote su última cotización mediante el lector compartido; usa el cálculo porcentual compartido para la variación diaria. Dentro de `instruments`, `InstrumentSearchItem`, `InstrumentSearchCriteria` e `InstrumentSearchPage` son contratos del caso de uso y se ubican en `application/interfaces/`. No se crea un modelo de dominio para una consulta sin reglas propias.

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

El controller recibe y devuelve DTOs HTTP. El caso de uso trabaja con contratos sin decoradores ni dependencias del framework. Los puertos pertenecen a aplicación porque expresan qué necesita el caso de uso. El módulo Nest conecta cada puerto con su adaptador. `domain/` se reserva para reglas, entidades y valores propios del negocio, por lo que una feature sin lógica de dominio puede no usarlo. Las entidades TypeORM compartidas permanecen en `shared/infrastructure/persistence/entities/`. Las subcarpetas opcionales se crean solo cuando contienen código. Cada contrato, DTO, caso de uso y adaptador tiene su propio archivo.

Todas las pruebas viven bajo `test/`. `unit/` contiene funciones o clases aisladas, `feature/` levanta módulos Nest con puertos simulados e `integration/` recorre HTTP e infraestructura real. Los imports internos usan `#src/*`. TypeScript usa `paths` y Vitest un alias explícito hacia `src`, mientras que el mapa nativo de `package.json` lo dirige a `dist` al ejecutar el build. Los imports locales dentro de una misma carpeta conservan `./`.

Los contratos de persistencia usan una clase abstracta `<Nombre>Repository` en `application/ports/<nombre>.repository.ts`, sin dependencias de NestJS ni TypeORM. Su implementación se llama `<Nombre>TypeOrmRepository` y vive en `infrastructure/persistence/<nombre>-typeorm.repository.ts`. El módulo Nest registra el contrato con `provide` y la implementación con `useClass` o `useFactory`. La clase abstracta sirve como tipo y como token de inyección, por lo que no requiere un token adicional. Cada contrato declara únicamente las operaciones necesarias para sus consumidores, sin agregar un repositorio genérico ni métodos CRUD sin uso.

El dominio compartido implementa dinero y reconstruye tanto los recursos ejecutados como la disponibilidad luego de reservas de órdenes `NEW`. `portfolio/domain/` agrega promedio ponderado móvil, valuación y rendimiento. `orders/domain/` implementa `evaluateOrder`, que calcula el precio aplicable, valida límites, convierte montos a acciones enteras y determina el estado (`FILLED`, `NEW` o `REJECTED`). `instruments` es una consulta sin reglas de dominio propias. Su adaptador incluye únicamente `ACCIONES`. Las transferencias de `MONEDA` aportan efectivo.

El cálculo de portfolio separa saldo ejecutado, reservas, reconstrucción cronológica del costo y valuación con cotizaciones. Las compras `NEW` reservan efectivo y las ventas `NEW` reservan acciones, sin modificar el patrimonio ni la posición ejecutada. Rendimiento y variación diaria reutilizan la misma fórmula porcentual, con bases distintas. Los helpers permanecen privados al cálculo, sin agregar capas.

Las excepciones de negocio extienden `Error`, sin dependencias HTTP. `InvalidAccountHistoryError` es compartida. Portfolio y orders definen sus propias excepciones (`UserNotFoundError`, `InvalidOrderError`, `MarketDataUnavailableError`). Filtros propios de cada feature las traducen mediante `ApiProblemException` y reutilizan el filtro compartido para publicar únicamente detalles seguros. Los fallos inesperados permanecen sanitizados. El rechazo financiero se persiste como `REJECTED`, responde `201` y se registra internamente con el tag `[orders.rejected]` y su motivo. No es una excepción HTTP ni agrega campos al contrato de la orden.

## Límites entre módulos

| Módulo        | Responsabilidad                                                              |
| ------------- | ---------------------------------------------------------------------------- |
| `instruments` | Búsqueda por ticker y nombre.                                                |
| `orders`      | Cantidad o monto, reglas MARKET/LIMIT, disponibilidad y creación de órdenes. |
| `portfolio`   | Saldo, reservas, costo de la posición, valuación y rendimiento.              |
| `shared`      | Dinero, recursos, contratos de lectura y persistencia reutilizados.          |

Compartir la reconstrucción ejecutada y la disponibilidad mantiene una interpretación común del historial entre portfolio y orders. Los DTOs HTTP y casos de uso pertenecen a su feature.

Las cuatro entidades TypeORM del esquema provisto y la entidad genérica de idempotencia están centralizadas en infraestructura compartida. Sus detalles no llegan al dominio ni a los casos de uso.

`UserRepository`, en `shared/application/ports/`, declara la lectura `exists(userId)` y `UserTypeOrmRepository`, en infraestructura compartida, consulta `UserEntity`. `PortfolioModule` registra ese adaptador mediante una factory. `GetPortfolio` coordina la consulta y decide cómo tratar la ausencia del usuario. `PortfolioRepository` obtiene el snapshot financiero. `TradingRepository` se limita a movimientos y cotizaciones.

## Consistencia y concurrencia

La estrategia para órdenes es una transacción `READ COMMITTED` con bloqueo pesimista de la fila del usuario (`pessimistic_write` / `FOR UPDATE`) antes de validar disponibilidad. El lock serializa las órdenes de una cuenta y cada lectura posterior incorpora el último commit, incluida una orden que hubiera esperado el mismo bloqueo. Las lecturas de instrumento, cotización y movimientos `FILLED` y `NEW`, la evaluación de dominio y la escritura usan el mismo `EntityManager`. Si los recursos disponibles después de reservas son insuficientes, el rechazo financiero se confirma como `REJECTED`.

`IdempotencyKeyMiddleware` exige un UUID v4 en `Idempotency-Key` para `POST /orders` y lo guarda en `IdempotencyKeyContext`, respaldado por `AsyncLocalStorage`. El controller y el caso de uso no reciben la clave. El adaptador transaccional la obtiene del contexto y reclama una fila en `idempotency_records`. Su restricción única abarca operación, alcance y clave. El hash representa la solicitud normalizada. Una clave nueva guarda resultado y código HTTP. La misma clave y hash los recupera, mientras que otro hash produce conflicto. La ejecución de la orden se aísla con un savepoint. Una cotización MARKET ausente revierte toda la transacción antes de crear la orden y permite reintentar la misma clave. Un fallo técnico inesperado revierte sus escrituras hasta el savepoint y confirma `500` con la clave. Si no es posible confirmar ese registro, el resultado queda incierto para el cliente.

El bloqueo por usuario serializa las operaciones de una misma cuenta. Una orden que espera el lock vuelve a calcular la disponibilidad incluyendo las reservas confirmadas por la anterior, lo que impide comprometer dos veces el mismo efectivo o las mismas acciones. Cuentas distintas avanzan independientemente. Portfolio usa su propia transacción `REPEATABLE READ`, con `SET TRANSACTION READ ONLY` antes de leer movimientos `FILLED` y `NEW`.

`GetPortfolio` consulta existencia mediante `UserRepository` y decide si lanzar `UserNotFoundError` antes de solicitar el snapshot. En `orders`, la existencia se valida de forma atómica dentro de la transacción al intentar adquirir el bloqueo de la fila del usuario en `users`.

El caso de uso `SubmitOrder` no depende de TypeORM ni expone managers. Recibe únicamente `OrderRequest`, delega la operación atómica al puerto específico `OrderRepository` y presenta el resultado persistido como strings decimales y fecha ISO. `OrderTypeOrmRepository` encapsula la transacción completa: coordina lock e idempotencia, carga los datos, calcula la disponibilidad, llama a la función pura `evaluateOrder` y persiste con el mismo manager. El controller transforma el DTO en `OrderRequest` y devuelve `{ data }` mediante `OrderResponseDto`.

`IdempotencyTypeOrmRepository` es una capacidad compartida de persistencia que reclama claves y guarda código HTTP y resultado JSON usando el manager recibido. El adaptador de órdenes define el alcance, calcula el hash y reconstruye el resultado. Así el esquema compartido no depende de `orders`. Middleware y contexto resuelven la preocupación HTTP transversal, mientras el adaptador conserva la atomicidad con la orden. `REJECTED` se confirma con `201`; solo los fallos inesperados confirmados se guardan con `500` sin orden.

## Performance

Las lecturas financieras seleccionan las columnas necesarias y obtienen instrumentos y cotizaciones en lote. Con el volumen actual, los índices adicionales evaluados no mejoraron los planes de órdenes y cotizaciones. La decisión y sus límites están en [supuestos y decisiones](assumptions.md#índices-de-órdenes-y-cotizaciones).
