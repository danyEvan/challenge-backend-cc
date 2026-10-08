import type { Money } from '#src/shared/domain/money/money.js';
import type {
  OrderSide,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export interface OrderRequest {
  readonly userId: number;
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size?: number;
  readonly amount?: Money;
  readonly price?: Money;
}
