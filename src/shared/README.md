# Elementos compartidos

Capacidades utilizadas por varios módulos. Sus límites se explican en [arquitectura](../../docs/architecture.md).

| Carpeta                       | Responsabilidad                                                 |
| ----------------------------- | --------------------------------------------------------------- |
| `domain/money/`               | Aritmética monetaria inmutable en ARS.                          |
| `domain/account/`             | Movimientos y reconstrucción de efectivo y cantidades.          |
| `domain/trading/`             | Vocabulario compartido y datos de cotizaciones.                 |
| `application/ports/`          | Puertos separados para usuarios y lecturas de mercado.          |
| `infrastructure/persistence/` | Conexión, entidades, adaptadores TypeORM y `TradingReadModule`. |
| `infrastructure/http/`        | Filtro compartido y DTO de Problem Details.                     |

## Dinero

Crear `Money` desde strings decimales o `Decimal`. Las operaciones usan 40 dígitos de precisión interna; `toString()` y JSON presentan dos decimales con `ROUND_HALF_UP`.

Conservar precisión durante el cálculo y definir el formato HTTP al implementar cada contrato.

## Reconstrucción de recursos

`calculateAccountResources` devuelve efectivo disponible y cantidades por instrumento. Cuenta únicamente movimientos `FILLED`, incluyendo MARKET y LIMIT históricas.

```text
efectivo = CASH_IN.size − CASH_OUT.size
           − SUM(BUY.size × BUY.price)
           + SUM(SELL.size × SELL.price)

cantidad = SUM(BUY.size) − SUM(SELL.size)
```

- Las transferencias usan `size` como pesos, sin multiplicar por el precio.
- Los estados `NEW`, `REJECTED` y `CANCELLED` no afectan recursos, bajo la política de reservas documentada en [supuestos](../../docs/assumptions.md).
- Conservar saldos y cantidades negativos heredados; omitir posiciones cerradas con cantidad cero.
- Exigir cantidades ejecutadas positivas y enteras seguras; comprobar también el rango de las cantidades acumuladas.
- Un precio histórico ausente o negativo en una compra/venta ejecutada produce `InvalidAccountHistoryError`. Un precio conocido de cero permite reconstruir recursos.
- La validación de órdenes nuevas y el cálculo de costo/rendimiento pertenecen a sus features.

## Lecturas

`UserRepository`, en `application/ports/user.repository.ts`, declara `exists(userId)`. `UserTypeOrmRepository` implementa la consulta a `UserEntity`; el caso de uso decide qué hacer si no existe. `PortfolioModule` registra el adaptador mediante una factory.

`TradingRepository` es el contrato abstracto para consultar movimientos ejecutados y últimas cotizaciones. Está en `application/ports/trading.repository.ts`. Ambos puertos también funcionan como tokens de inyección.

Los movimientos se ordenan por `datetime ASC, id ASC`; campos imprescindibles ausentes producen `InvalidAccountHistoryError`. El tipo histórico puede ser nulo: el estado ejecutado, no el tipo, determina su efecto. Las cotizaciones se eligen por instrumento y `date DESC NULLS LAST, id DESC`, sin exigir la fecha actual. Un instrumento sin cotización queda ausente; precio o fecha nulos permanecen nulos para que el consumidor informe datos insuficientes.

## Integración transaccional

`TradingTypeOrmRepository`, en `infrastructure/persistence/trading-typeorm.repository.ts`, implementa ese contrato y recibe un `EntityManager` en su constructor. La instancia de `TradingReadModule` utiliza el manager global y no abre transacciones.

Para órdenes, infraestructura deberá conectar el repositorio con el manager de la transacción después de bloquear al usuario. `GetPortfolio` consulta existencia mediante `UserRepository` antes de pedir el snapshot. Para movimientos y cotizaciones, el adaptador de portfolio crea su lector con el manager de una transacción `REPEATABLE READ` / `READ ONLY`. El manager permanece dentro de infraestructura.

Existen pruebas de dinero, recursos y portfolio sin base de datos. Las pruebas automatizadas de integración transaccional con PostgreSQL siguen pendientes.
