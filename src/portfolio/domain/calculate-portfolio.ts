import type { Decimal } from 'decimal.js';
import type { AccountMovement } from '../../shared/domain/account/account-movement.js';
import { calculateAccountResources } from '../../shared/domain/account/calculate-account-resources.js';
import { InvalidAccountHistoryError } from '../../shared/domain/account/errors/invalid-account-history.error.js';
import { Money } from '../../shared/domain/money/money.js';
import type { MarketQuote } from '../../shared/domain/trading/market-quote.js';
import {
  OrderSide,
  OrderStatus,
} from '../../shared/domain/trading/trading.types.js';
import { PortfolioDataUnavailableError } from './errors/portfolio-data-unavailable.error.js';
import type { ValuedPosition } from './valued-position.js';

export function calculatePortfolio(
  movements: readonly AccountMovement[],
  quotes: ReadonlyMap<number, MarketQuote>,
): { availableCash: Money; totalValue: Money; positions: ValuedPosition[] } {
  const resources = calculateAccountResources(movements);
  const positionCosts = calculatePositionCosts(movements);
  const positions: ValuedPosition[] = [];
  let totalValue = resources.availableCash;

  for (const [instrumentId, quantity] of resources.positions) {
    const quote = quotes.get(instrumentId);
    if (
      !quote ||
      quote.close === null ||
      quote.close.isNegative() ||
      quote.date === null
    ) {
      throw new PortfolioDataUnavailableError();
    }

    const marketValue = quote.close.multiply(quantity);
    const costBasis = positionCosts.get(instrumentId)?.costBasis ?? null;
    totalValue = totalValue.add(marketValue);
    positions.push({
      instrumentId,
      quantity,
      marketPrice: quote.close,
      marketValue,
      costBasis,
      returnPercentage: calculatePercentageChange(marketValue, costBasis),
      dailyPriceChangePercentage: calculatePercentageChange(
        quote.close,
        quote.previousClose,
      ),
      quoteDate: quote.date,
    });
  }

  return { availableCash: resources.availableCash, totalValue, positions };
}

function calculatePositionCosts(movements: readonly AccountMovement[]) {
  const positionCosts = new Map<
    number,
    { quantity: number; costBasis: Money | null }
  >();
  const executedMovements = movements.filter(
    (movement) => movement.status === OrderStatus.FILLED,
  );
  if (
    executedMovements.some(
      (movement) => !Number.isFinite(movement.datetime.getTime()),
    )
  ) {
    throw new InvalidAccountHistoryError('Executed movement date is invalid');
  }

  executedMovements.sort(
    (a, b) => a.datetime.getTime() - b.datetime.getTime() || a.id - b.id,
  );

  for (const movement of executedMovements) {
    if (movement.side !== OrderSide.BUY && movement.side !== OrderSide.SELL) {
      continue;
    }

    const state = positionCosts.get(movement.instrumentId) ?? {
      quantity: 0,
      costBasis: Money.zero(),
    };
    const isBuy = movement.side === OrderSide.BUY;
    if (!isBuy && movement.size > state.quantity) {
      // Una sobreventa no permite reconstruir un costo long válido.
      state.costBasis = null;
    } else if (state.costBasis !== null && movement.price !== null) {
      if (isBuy) {
        const purchaseCost = movement.price.multiply(movement.size);
        state.costBasis = state.costBasis.add(purchaseCost);
      } else {
        const remainingQuantity = state.quantity - movement.size;
        const remainingCost = state.costBasis
          .toDecimal()
          .times(remainingQuantity)
          .div(state.quantity);
        state.costBasis = Money.from(remainingCost);
      }
    }

    state.quantity += isBuy ? movement.size : -movement.size;
    if (state.quantity === 0 && state.costBasis !== null) {
      state.costBasis = Money.zero();
    }
    positionCosts.set(movement.instrumentId, state);
  }

  return positionCosts;
}

function calculatePercentageChange(
  current: Money,
  base: Money | null,
): Decimal | null {
  if (base === null || base.compare(Money.zero()) <= 0) {
    return null;
  }

  return current.subtract(base).toDecimal().div(base.toDecimal()).times(100);
}
