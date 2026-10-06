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
Caso de uso → puerto TradingReader
                       ↑
             adaptador TypeORM
```

`TradingReader` es una clase abstracta y un token de inyección. El adaptador transforma resultados de TypeORM en modelos independientes del ORM.

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

Estas garantías están pendientes de implementación y pruebas con PostgreSQL. La [guía de shared](../src/shared/README.md) explica cómo conectar el lector al manager transaccional.

## Performance

Los candidatos de índices y cambios de esquema se mantienen en la [guía de PostgreSQL](../database/README.md). Las [evidencias](evidence/README.md) registrarán su evaluación y sus límites.
