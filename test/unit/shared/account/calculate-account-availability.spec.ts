import { describe, expect, it } from 'vitest';
import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import { calculateAccountAvailability } from '#src/shared/domain/account/calculate-account-availability.js';
import { InvalidAccountHistoryError } from '#src/shared/domain/account/errors/invalid-account-history.error.js';
import { Money } from '#src/shared/domain/money/money.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

function movement(overrides: Partial<AccountMovement> = {}): AccountMovement {
  return {
    id: 1,
    instrumentId: 1,
    size: 1,
    price: Money.from('10'),
    side: OrderSide.BUY,
    status: OrderStatus.FILLED,
    type: OrderType.MARKET,
    datetime: new Date('2023-07-12T12:00:00Z'),
    ...overrides,
  };
}

describe('calculateAccountAvailability', () => {
  it('subtracts NEW reservations from executed cash and holdings', () => {
    const availability = calculateAccountAvailability([
      movement({
        instrumentId: 66,
        side: OrderSide.CASH_IN,
        size: 1000,
        price: null,
      }),
      movement({ size: 10, price: Money.from('10') }),
      movement({
        id: 2,
        size: 2,
        price: Money.from('100'),
        status: OrderStatus.NEW,
        type: OrderType.LIMIT,
      }),
      movement({
        id: 3,
        side: OrderSide.SELL,
        size: 3,
        price: Money.from('20'),
        status: OrderStatus.NEW,
        type: OrderType.LIMIT,
      }),
      movement({ id: 4, size: 100, status: OrderStatus.REJECTED }),
      movement({ id: 5, size: 100, status: OrderStatus.CANCELLED }),
    ]);

    expect(availability.cashBalance.toString()).toBe('900.00');
    expect(availability.reservedCash.toString()).toBe('200.00');
    expect(availability.availableCash.toString()).toBe('700.00');
    expect(availability.positions.get(1)).toEqual({
      quantity: 10,
      reservedQuantity: 3,
      availableQuantity: 7,
    });
  });

  it('rejects a pending order without the data needed to reserve resources', () => {
    expect(() =>
      calculateAccountAvailability([
        movement({
          price: null,
          status: OrderStatus.NEW,
          type: OrderType.LIMIT,
        }),
      ]),
    ).toThrow(InvalidAccountHistoryError);
  });
});
