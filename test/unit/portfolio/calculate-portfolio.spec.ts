import { describe, expect, it } from 'vitest';
import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import { Money } from '#src/shared/domain/money/money.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { calculatePortfolio } from '#src/portfolio/domain/calculate-portfolio.js';
import { PortfolioDataUnavailableError } from '#src/portfolio/domain/errors/portfolio-data-unavailable.error.js';

function movement(
  id: number,
  side: AccountMovement['side'],
  size: number,
  price: string,
): AccountMovement {
  return {
    id,
    instrumentId: 1,
    side,
    size,
    price: Money.from(price),
    status: OrderStatus.FILLED,
    type: OrderType.MARKET,
    datetime: new Date('2023-07-12T12:00:00Z'),
  };
}

function quotes(
  close = '200',
  previousClose: string | null = '180',
): Map<number, MarketQuote> {
  return new Map([
    [
      1,
      {
        instrumentId: 1,
        close: Money.from(close),
        previousClose:
          previousClose === null ? null : Money.from(previousClose),
        date: '2023-07-14',
      },
    ],
  ]);
}

describe('calculatePortfolio', () => {
  it('uses chronological moving average after a partial sale and a later buy', () => {
    const result = calculatePortfolio(
      [
        {
          ...movement(5, OrderSide.BUY, 5, '300'),
          datetime: new Date('2023-07-13T12:00:00Z'),
        },
        movement(1, OrderSide.CASH_IN, 10000, '1'),
        movement(3, OrderSide.BUY, 10, '200'),
        movement(2, OrderSide.BUY, 10, '100'),
        movement(4, OrderSide.SELL, 5, '180'),
      ],
      quotes(),
    );

    expect(result.availableCash.toString()).toBe('6400.00');
    expect(result.totalValue.toString()).toBe('10400.00');
    const position = result.positions[0]!;
    expect(position.quantity).toBe(20);
    expect(position.marketValue.toString()).toBe('4000.00');
    expect(position.costBasis?.toString()).toBe('3750.00');
    expect(position.returnPercentage?.toFixed(2)).toBe('6.67');
    expect(position.dailyPriceChangePercentage?.toFixed(2)).toBe('11.11');
  });

  it('keeps fractional average costs unrounded until presentation', () => {
    const result = calculatePortfolio(
      [
        movement(1, OrderSide.BUY, 2, '1'),
        movement(2, OrderSide.BUY, 1, '2'),
        movement(3, OrderSide.SELL, 1, '3'),
      ],
      quotes('2'),
    );

    expect(result.positions[0]?.costBasis?.toString()).toBe('2.67');
    expect(result.positions[0]?.returnPercentage?.toFixed(2)).toBe('50.00');
  });

  it('resets a valid closed position and avoids division by zero', () => {
    const result = calculatePortfolio(
      [
        movement(1, OrderSide.BUY, 2, '100'),
        movement(2, OrderSide.SELL, 2, '150'),
        movement(3, OrderSide.BUY, 1, '0'),
      ],
      quotes('0', '0'),
    );

    expect(result.positions[0]?.quantity).toBe(1);
    expect(result.positions[0]?.costBasis?.toString()).toBe('0.00');
    expect(result.positions[0]?.returnPercentage).toBeNull();
    expect(result.positions[0]?.dailyPriceChangePercentage).toBeNull();
    expect(result.totalValue.toString()).toBe('100.00');
  });

  it('does not assume that later purchases reconcile an oversold history', () => {
    const result = calculatePortfolio(
      [
        movement(1, OrderSide.BUY, 2, '100'),
        movement(2, OrderSide.SELL, 3, '150'),
        movement(3, OrderSide.BUY, 1, '140'),
        movement(4, OrderSide.BUY, 1, '160'),
      ],
      quotes(),
    );

    expect(result.positions[0]?.quantity).toBe(1);
    expect(result.positions[0]?.costBasis).toBeNull();
    expect(result.positions[0]?.returnPercentage).toBeNull();
  });

  it('fails explicitly when an open position cannot be valued', () => {
    const movements = [movement(1, OrderSide.BUY, 1, '100')];
    expect(() => calculatePortfolio(movements, new Map())).toThrow(
      PortfolioDataUnavailableError,
    );
    const incomplete = quotes();
    incomplete.set(1, {
      instrumentId: 1,
      close: null,
      previousClose: null,
      date: null,
    });
    expect(() => calculatePortfolio(movements, incomplete)).toThrow(
      PortfolioDataUnavailableError,
    );
  });
});
