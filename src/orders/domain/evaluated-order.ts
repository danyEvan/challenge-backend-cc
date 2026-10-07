import type { Money } from '#src/shared/domain/money/money.js';
import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export interface EvaluatedOrder {
  readonly size: number;
  readonly price: Money;
  readonly status: OrderStatus;
  readonly side: OrderSide;
  readonly type: OrderType;
}
