import type { Money } from '#src/shared/domain/money/money.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { InvalidOrderError } from '#src/orders/domain/errors/invalid-order.error.js';
import { MarketDataUnavailableError } from '#src/orders/domain/errors/market-data-unavailable.error.js';
import type { EvaluatedOrder } from './evaluated-order.js';
import {
  MAX_ORDER_MONEY,
  MAX_ORDER_SIZE,
  ORDER_MONEY_DECIMAL_PLACES,
} from './order-limits.js';

export interface EvaluateOrderInput {
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size?: number;
  readonly amount?: Money;
  readonly price?: Money;
  readonly marketQuote?: MarketQuote;
  readonly availableCash: Money;
  readonly availableShares: number;
}

export function evaluateOrder(input: EvaluateOrderInput): EvaluatedOrder {
  validateOrderRequest(input);

  const price = resolveApplicablePrice(input);
  const size = resolveOrderSize(input, price);
  const status = determineOrderStatus(input, price, size);

  return {
    size,
    price,
    status,
    side: input.side,
    type: input.type,
  };
}

function validateOrderRequest(input: EvaluateOrderInput): void {
  if (input.side !== OrderSide.BUY && input.side !== OrderSide.SELL) {
    throw new InvalidOrderError('Order side must be BUY or SELL');
  }

  const hasSize = input.size !== undefined && input.size !== null;
  const hasAmount = input.amount !== undefined && input.amount !== null;

  if (hasSize === hasAmount) {
    throw new InvalidOrderError(
      'Exactly one of size or amount must be specified',
    );
  }
}

function resolveApplicablePrice(input: EvaluateOrderInput): Money {
  if (input.type === OrderType.MARKET) {
    if (input.price !== undefined && input.price !== null) {
      throw new InvalidOrderError('MARKET orders cannot include a limit price');
    }

    if (!input.marketQuote || !input.marketQuote.close) {
      throw new MarketDataUnavailableError(
        'Latest market quote is not available for this instrument',
      );
    }

    validatePositiveOrderMoney(input.marketQuote.close, 'Market price');
    return input.marketQuote.close;
  }

  if (input.type === OrderType.LIMIT) {
    if (input.price === undefined || input.price === null) {
      throw new InvalidOrderError('LIMIT orders require a positive price');
    }

    validatePositiveOrderMoney(input.price, 'Order price');
    return input.price;
  }

  throw new InvalidOrderError('Unsupported order type');
}

function resolveOrderSize(input: EvaluateOrderInput, price: Money): number {
  if (input.size !== undefined && input.size !== null) {
    if (
      !Number.isSafeInteger(input.size) ||
      input.size <= 0 ||
      input.size > MAX_ORDER_SIZE
    ) {
      throw new InvalidOrderError(
        `Order size must be an integer between 1 and ${MAX_ORDER_SIZE}`,
      );
    }
    return input.size;
  }

  if (input.amount === undefined || input.amount === null) {
    throw new InvalidOrderError('Order amount must be a positive decimal');
  }

  validatePositiveOrderMoney(input.amount, 'Order amount');
  const calculatedSize = input.amount
    .toDecimal()
    .dividedBy(price.toDecimal())
    .floor()
    .toNumber();

  if (
    !Number.isSafeInteger(calculatedSize) ||
    calculatedSize <= 0 ||
    calculatedSize > MAX_ORDER_SIZE
  ) {
    throw new InvalidOrderError(
      `Calculated share quantity must be between 1 and ${MAX_ORDER_SIZE}`,
    );
  }

  return calculatedSize;
}

function determineOrderStatus(
  input: EvaluateOrderInput,
  price: Money,
  size: number,
): OrderStatus {
  const acceptedStatus =
    input.type === OrderType.MARKET ? OrderStatus.FILLED : OrderStatus.NEW;

  if (input.side === OrderSide.BUY) {
    const requiredCash = price.multiply(size);
    return input.availableCash.compare(requiredCash) < 0
      ? OrderStatus.REJECTED
      : acceptedStatus;
  }

  return input.availableShares < size ? OrderStatus.REJECTED : acceptedStatus;
}

function validatePositiveOrderMoney(value: Money, field: string): void {
  const decimal = value.toDecimal();
  if (
    !decimal.isPositive() ||
    decimal.decimalPlaces() > ORDER_MONEY_DECIMAL_PLACES ||
    decimal.greaterThan(MAX_ORDER_MONEY)
  ) {
    throw new InvalidOrderError(
      `${field} must be a positive decimal with at most two decimal places and no greater than ${MAX_ORDER_MONEY}`,
    );
  }
}
