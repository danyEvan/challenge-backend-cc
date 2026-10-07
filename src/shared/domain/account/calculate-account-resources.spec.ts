import { describe, expect, it } from 'vitest';
import { calculateAccountResources } from './calculate-account-resources.js';
import { Money } from '../money/money.js';
import type { AccountMovement } from './account-movement.js';
import { OrderSide, OrderStatus, OrderType } from '../trading/trading.types.js';
import { InvalidAccountHistoryError } from './errors/invalid-account-history.error.js';

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

describe('calculateAccountResources', () => {
  it('reconstructs transfers, cash and holdings from FILLED MARKET and LIMIT trades', () => {
    const result = calculateAccountResources([
      movement({
        instrumentId: 66,
        side: OrderSide.CASH_IN,
        size: 1000,
        price: null,
      }),
      movement({
        instrumentId: 66,
        side: OrderSide.CASH_OUT,
        size: 100,
        price: Money.from('20'),
      }),
      movement({ size: 3, price: Money.from('10.10') }),
      movement({ side: OrderSide.SELL, size: 1, price: Money.from('12.35') }),
      movement({
        instrumentId: 2,
        size: 2,
        price: Money.from('1.05'),
        type: OrderType.LIMIT,
      }),
    ]);

    expect(result.availableCash.toString()).toBe('879.95');
    expect(result.positions).toEqual(
      new Map([
        [1, 2],
        [2, 2],
      ]),
    );
  });

  it('ignores NEW, REJECTED and CANCELLED movements without reserving funds', () => {
    const result = calculateAccountResources([
      movement({ side: OrderSide.CASH_IN, size: 1000 }),
      movement({ size: 100, type: OrderType.LIMIT, status: OrderStatus.NEW }),
      movement({
        side: OrderSide.SELL,
        size: 100,
        status: OrderStatus.REJECTED,
      }),
      movement({
        side: OrderSide.CASH_OUT,
        size: 100,
        price: null,
        status: OrderStatus.CANCELLED,
      }),
    ]);

    expect(result.availableCash.toString()).toBe('1000.00');
    expect(result.positions.size).toBe(0);
  });

  it('removes positions that have been fully sold', () => {
    const result = calculateAccountResources([
      movement({ size: 2 }),
      movement({ side: OrderSide.SELL, size: 2, price: Money.from('12') }),
    ]);

    expect(result.availableCash.toString()).toBe('4.00');
    expect(result.positions.has(1)).toBe(false);
  });

  it('preserves negative cash and holdings inherited from inconsistent history', () => {
    const result = calculateAccountResources([
      movement({ side: OrderSide.CASH_OUT, size: 20000 }),
      movement({ instrumentId: 31, size: 20, price: Money.from('1540') }),
      movement({
        instrumentId: 31,
        side: OrderSide.SELL,
        size: 30,
        price: Money.from('1530'),
      }),
    ]);

    expect(result.availableCash.toString()).toBe('-4900.00');
    expect(result.positions.get(31)).toBe(-10);
  });

  it('rejects missing execution prices instead of inventing a cash balance', () => {
    expect(() =>
      calculateAccountResources([movement({ price: null })]),
    ).toThrow('Executed trades require a historical price');
  });

  it.each([0, 1.5])('rejects invalid executed movement size %s', (size) => {
    expect(() => calculateAccountResources([movement({ size })])).toThrow(
      InvalidAccountHistoryError,
    );
  });
});
