import type { Money } from '#src/shared/domain/money/money.js';
import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export type AccountMovement = Readonly<{
  id: number;
  instrumentId: number;
  size: number;
  price: Money | null;
  side: OrderSide;
  status: OrderStatus;
  type: OrderType | null;
  datetime: Date;
}>;
