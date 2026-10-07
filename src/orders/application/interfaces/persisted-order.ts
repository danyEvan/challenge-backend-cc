import type { Money } from '#src/shared/domain/money/money.js';
import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export interface PersistedOrder {
  readonly id: number;
  readonly userId: number;
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size: number;
  readonly price: Money;
  readonly status: OrderStatus;
  readonly datetime: Date;
}
