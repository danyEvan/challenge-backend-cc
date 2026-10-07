import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export interface OrderResult {
  readonly id: number;
  readonly userId: number;
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size: number;
  readonly price: string;
  readonly status: OrderStatus;
  readonly datetime: string;
}
