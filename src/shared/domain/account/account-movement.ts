import type { Money } from '../money/money.js';
import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../trading/trading.types.js';

export type AccountMovement = Readonly<{
  id: number;
  instrumentId: number;
  size: number;
  price: Money | null;
  side: OrderSide;
  status: OrderStatus;
  type: OrderType;
  datetime: Date;
}>;
