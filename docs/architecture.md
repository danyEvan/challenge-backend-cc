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
      transforms/             # auxiliares HTTP reutilizables, si hacen falta
    persistence/              # adaptadores TypeORM y mapeo hacia datos de dominio
  <feature>.module.ts         # conexión de providers, puertos y controllers
```

El controller recibe y devuelve DTOs HTTP; el caso de uso trabaja con contratos sin decoradores ni dependencias del framework. Los puertos pertenecen a aplicación porque expresan qué necesita el caso de uso; el módulo Nest conecta cada puerto con su adaptador. `domain/` se reserva para reglas, entidades y valores propios del negocio: una feature sin lógica de dominio puede no usarlo. Las entidades TypeORM compartidas permanecen en `shared/infrastructure/persistence/entities/`. Crear subcarpetas opcionales solo cuando contengan código; cada contrato, DTO, caso de uso y adaptador tiene su propio archivo. Las pruebas unitarias se ubican junto al código y las HTTP/e2e en `test/`.

Los contratos de persistencia usan una clase abstracta `<Nombre>Repository` en `application/ports/<nombre>.repository.ts`, sin dependencias de NestJS ni TypeORM. Su implementación se llama `<Nombre>TypeOrmRepository` y vive en `infrastructure/persistence/<nombre>-typeorm.repository.ts`. El módulo Nest registra el contrato con `provide` y la implementación con `useClass` o `useFactory`. La clase abstracta sirve como tipo y como token de inyección; no requiere un token adicional. Cada contrato declara únicamente las operaciones necesarias para sus consumidores, sin agregar un repositorio genérico ni métodos CRUD sin uso.

El dominio financiero implementado está en `shared/domain/`: dinero y reconstrucción de efectivo y tenencia. `orders` y `portfolio` conservan sus carpetas de dominio del scaffold para los flujos pendientes. `instruments` es una consulta del catálogo negociable y no necesita reglas de dominio ni excepciones de negocio propias. Su adaptador incluye únicamente `ACCIONES`; `MONEDA` permanece como representación interna del efectivo.

Las excepciones de negocio concretas se ubican en `domain/errors/` de la feature o del dominio compartido y extienden `Error` sin dependencias HTTP. Infraestructura las traduce a Problem Details según el contrato del flujo. Actualmente los cálculos compartidos usan `RangeError` para historial inválido; tipificar esas condiciones y definir su traducción queda pendiente al implementar portfolio. El rechazo financiero de una orden se persiste como `REJECTED`, de acuerdo con los supuestos, y se distingue de un fallo técnico.

## Límites entre módulos

| Módulo        | Responsabilidad                                                              |
| ------------- | ---------------------------------------------------------------------------- |
| `instruments` | Búsqueda por ticker y nombre.                                                |
| `orders`      | Cantidad o monto, reglas MARKET/LIMIT, disponibilidad y creación de órdenes. |
| `portfolio`   | Costo de la posición, valuación y rendimiento.                               |
| `shared`      | Dinero, recursos, contratos de lectura y persistencia reutilizados.          |

Compartir la reconstrucción de recursos mantiene una interpretación común del historial. Los DTOs HTTP y casos de uso pertenecen a su feature.

Las cuatro entidades TypeORM mapean una base utilizada por varias funcionalidades y están centralizadas para reducir duplicación. Sus detalles permanecen en infraestructura.

## Consistencia y concurrencia

La estrategia elegida para órdenes es una transacción con bloqueo de la fila del usuario antes de validar disponibilidad. Las lecturas y la escritura usarán el mismo manager; el rechazo financiero también se confirmará.

El bloqueo por usuario permite que cuentas distintas avancen independientemente. Portfolio usará una lectura coherente mediante una consulta única o una transacción de lectura apropiada.

Estas garantías están pendientes de implementación y pruebas con PostgreSQL. La [guía de shared](../src/shared/README.md) explica cómo conectar el repositorio al manager transaccional.

## Performance

Los candidatos de índices y cambios de esquema se mantienen en la [guía de PostgreSQL](../database/README.md). Las [evidencias](evidence/README.md) registrarán su evaluación y sus límites.
