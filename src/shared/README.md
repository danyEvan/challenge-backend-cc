# Elementos compartidos

Capacidades utilizadas por varios módulos. Sus límites se explican en [arquitectura](../../docs/architecture.md).

| Carpeta                       | Responsabilidad                                                     |
| ----------------------------- | ------------------------------------------------------------------- |
| `domain/money/`               | Aritmética monetaria inmutable en ARS.                              |
| `domain/account/`             | Movimientos y reconstrucción de efectivo y cantidades.              |
| `domain/trading/`             | Vocabulario compartido y datos de cotizaciones.                     |
| `application/ports/`          | Puertos separados para usuarios y lecturas de mercado.              |
| `infrastructure/persistence/` | Conexión, entidades, adaptadores TypeORM e idempotencia compartida. |
| `infrastructure/http/`        | Filtro compartido y DTO de Problem Details.                         |

## Dinero

Crear `Money` desde strings decimales o `Decimal`. Las operaciones usan 40 dígitos de precisión interna. `toString()` y JSON presentan dos decimales con `ROUND_HALF_UP`.

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
- Conservar saldos y cantidades negativos heredados y omitir posiciones cerradas con cantidad cero.
- Exigir cantidades ejecutadas positivas y enteras seguras. Comprobar también el rango de las cantidades acumuladas.
- Un precio histórico ausente o negativo en una compra/venta ejecutada produce `InvalidAccountHistoryError`. Un precio conocido de cero permite reconstruir recursos.
- La validación de órdenes nuevas y el cálculo de costo/rendimiento pertenecen a sus features.

## Lecturas

`UserRepository`, en `application/ports/user.repository.ts`, declara `exists(userId)`. `UserTypeOrmRepository` implementa la consulta a `UserEntity`. El caso de uso decide qué hacer si no existe. `PortfolioModule` registra el adaptador mediante una factory.

`TradingRepository` es el contrato abstracto para consultar movimientos ejecutados y últimas cotizaciones. Está en `application/ports/trading.repository.ts`. Ambos puertos también funcionan como tokens de inyección.

Los movimientos se ordenan por `datetime ASC, id ASC`. Los campos imprescindibles ausentes producen `InvalidAccountHistoryError`. El tipo histórico puede ser nulo porque el estado ejecutado, no el tipo, determina su efecto. Las cotizaciones se eligen por instrumento y `date DESC NULLS LAST, id DESC`, sin exigir la fecha actual. Un instrumento sin cotización queda ausente. El precio o la fecha permanecen nulos para que el consumidor informe datos insuficientes.

## Integración transaccional

`TradingTypeOrmRepository`, en `infrastructure/persistence/trading-typeorm.repository.ts`, implementa ese contrato y recibe un `EntityManager` en su constructor. La instancia de `TradingReadModule` utiliza el manager global y no abre transacciones.

Para órdenes, infraestructura conecta el lector con el manager de la transacción después de bloquear al usuario. El mismo manager reclama la clave idempotente obligatoria, evalúa y persiste. `GetPortfolio` consulta existencia mediante `UserRepository` antes de pedir el snapshot. Para movimientos y cotizaciones, el adaptador de portfolio crea su lector con el manager de una transacción `REPEATABLE READ` / `READ ONLY`. El manager permanece dentro de infraestructura.

`IdempotencyKeyMiddleware` valida el UUID v4 y `IdempotencyKeyContext` lo conserva por request sin pasarlo por controllers ni casos de uso. `IdempotencyTypeOrmRepository` recibe el manager transaccional y persiste `(operation, scope, key)`, hash, código HTTP y resultado JSON. Cada feature define su operación, alcance y cómo serializar el resultado. La tabla no contiene identificadores ni foreign keys particulares de órdenes. Toda la coordinación queda en infraestructura, no en `SubmitOrder` ni `evaluateOrder`.

Existen pruebas sin base de datos para dinero, recursos, portfolio y órdenes. La suite de integración transaccional con PostgreSQL incluye concurrencia e idempotencia y se ejecuta contra `cocos_test`.
