import { describe, expect, it } from 'vitest';
import { Money } from '#src/shared/domain/money/money.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { InvalidOrderError } from '#src/orders/domain/errors/invalid-order.error.js';
import { MarketDataUnavailableError } from '#src/orders/domain/errors/market-data-unavailable.error.js';
import { evaluateOrder } from '#src/orders/domain/evaluate-order.js';

describe('evaluateOrder domain function', () => {
  const quotePamp = {
    instrumentId: 47,
    close: Money.from('925.85'),
    previousClose: Money.from('921.80'),
    date: '2023-07-14',
  };

  it('evaluates a valid MARKET BUY by exact size and marks it FILLED', () => {
    const result = evaluateOrder({
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      size: 10,
      marketQuote: quotePamp,
      availableCash: Money.from('50000.00'),
      availableShares: 0,
    });

    expect(result).toEqual({
      size: 10,
      price: Money.from('925.85'),
      status: OrderStatus.FILLED,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    });
  });

  it('evaluates a valid MARKET BUY by amount using floor conversion', () => {
    // 5000 / 925.85 = 5.4004 -> 5 shares
    const result = evaluateOrder({
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      amount: Money.from('5000.00'),
      marketQuote: quotePamp,
      availableCash: Money.from('10000.00'),
      availableShares: 0,
    });

    expect(result.size).toBe(5);
    expect(result.status).toBe(OrderStatus.FILLED);
  });

  it('rejects an amount that converts to 0 shares with InvalidOrderError', () => {
    // 500 / 925.85 = 0.54 -> 0 shares
    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        amount: Money.from('500.00'),
        marketQuote: quotePamp,
        availableCash: Money.from('10000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);
  });

  it('fails with MarketDataUnavailableError if MARKET order has missing quote or close', () => {
    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 10,
        marketQuote: undefined,
        availableCash: Money.from('50000.00'),
        availableShares: 0,
      }),
    ).toThrow(MarketDataUnavailableError);
  });

  it('marks BUY order as REJECTED when available cash is insufficient', () => {
    // 10 * 925.85 = 9258.50 > 5000.00
    const result = evaluateOrder({
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      size: 10,
      marketQuote: quotePamp,
      availableCash: Money.from('5000.00'),
      availableShares: 0,
    });

    expect(result.status).toBe(OrderStatus.REJECTED);
    expect(result.size).toBe(10);
  });

  it('evaluates a valid LIMIT BUY with sufficient cash and marks it NEW', () => {
    const result = evaluateOrder({
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      size: 20,
      price: Money.from('900.00'),
      availableCash: Money.from('20000.00'),
      availableShares: 0,
    });

    expect(result).toEqual({
      size: 20,
      price: Money.from('900.00'),
      status: OrderStatus.NEW,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
    });
  });

  it('rejects a LIMIT order if price is missing or non-positive', () => {
    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        size: 20,
        availableCash: Money.from('20000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);

    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        size: 20,
        price: Money.from('-5.00'),
        availableCash: Money.from('20000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);
  });

  it('marks SELL order as FILLED when enough shares exist', () => {
    const result = evaluateOrder({
      side: OrderSide.SELL,
      type: OrderType.MARKET,
      size: 15,
      marketQuote: quotePamp,
      availableCash: Money.zero(),
      availableShares: 20,
    });

    expect(result.status).toBe(OrderStatus.FILLED);
  });

  it('marks SELL order as REJECTED when shares are insufficient', () => {
    const result = evaluateOrder({
      side: OrderSide.SELL,
      type: OrderType.MARKET,
      size: 15,
      marketQuote: quotePamp,
      availableCash: Money.zero(),
      availableShares: 10,
    });

    expect(result.status).toBe(OrderStatus.REJECTED);
  });

  it('throws InvalidOrderError when both size and amount or neither are passed', () => {
    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 10,
        amount: Money.from('5000.00'),
        marketQuote: quotePamp,
        availableCash: Money.from('10000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);

    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        marketQuote: quotePamp,
        availableCash: Money.from('10000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);
  });

  it('rejects values outside the order persistence limits', () => {
    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        size: 1,
        price: Money.from('0.001'),
        availableCash: Money.from('10000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);

    expect(() =>
      evaluateOrder({
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        size: 2147483648,
        price: Money.from('1.00'),
        availableCash: Money.from('10000.00'),
        availableShares: 0,
      }),
    ).toThrow(InvalidOrderError);
  });
});
