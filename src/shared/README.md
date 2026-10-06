# Elementos compartidos

Capacidades utilizadas por varios módulos. Sus límites se explican en [arquitectura](../../docs/architecture.md).

| Carpeta                       | Responsabilidad                                               |
| ----------------------------- | ------------------------------------------------------------- |
| `domain/money/`               | Aritmética monetaria inmutable en ARS.                        |
| `domain/account/`             | Movimientos y reconstrucción de efectivo y cantidades.        |
| `domain/trading/`             | Vocabulario compartido y datos de cotizaciones.               |
| `application/ports/`          | Contrato de lectura de usuarios, movimientos y precios.       |
| `infrastructure/persistence/` | Conexión, entidades, adaptador TypeORM y `TradingReadModule`. |

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
- Un precio histórico ausente en una compra o venta ejecutada produce un error. Un precio conocido de cero permite reconstruir recursos.
- La validación de órdenes nuevas y el cálculo de costo/rendimiento pertenecen a sus features.

## Lecturas

`TradingReader` consulta existencia de usuario, movimientos ejecutados y últimas cotizaciones.

Los movimientos se ordenan por `datetime ASC, id ASC`. Las cotizaciones se eligen por instrumento y `date DESC NULLS LAST, id DESC`, sin exigir la fecha actual. Un instrumento sin cotización queda ausente del resultado; el caso de uso decide cómo informar datos insuficientes.

## Integración transaccional

`TypeOrmTradingReader` recibe un `EntityManager` en su constructor. La instancia de `TradingReadModule` utiliza el manager global y no abre transacciones.

Para órdenes, infraestructura deberá conectar el lector con el manager de la transacción después de bloquear al usuario. Portfolio deberá mantener un mismo snapshot para sus lecturas. El manager permanece dentro de infraestructura.

Existen pruebas unitarias de dinero y recursos. La integración de las lecturas con PostgreSQL está pendiente.
