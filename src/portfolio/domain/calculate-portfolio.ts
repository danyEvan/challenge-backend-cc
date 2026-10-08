import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import {
  calculateAccountAvailability,
  type AccountPositionAvailability,
} from '#src/shared/domain/account/calculate-account-availability.js';
import { InvalidAccountHistoryError } from '#src/shared/domain/account/errors/invalid-account-history.error.js';
import { Money } from '#src/shared/domain/money/money.js';
import { calculatePercentageChange } from '#src/shared/domain/money/percentage-change.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import {
  OrderSide,
  OrderStatus,
} from '#src/shared/domain/trading/trading.types.js';
import { PortfolioDataUnavailableError } from '#src/portfolio/domain/errors/portfolio-data-unavailable.error.js';
import type { ValuedPosition } from './valued-position.js';

type PositionCostState = Readonly<{
  quantity: number;
  costBasis: Money | null;
}>;

type ValuableQuote = MarketQuote & {
  readonly close: Money;
  readonly date: string;
};

export function calculatePortfolio(
  movements: readonly AccountMovement[],
  quotes: ReadonlyMap<number, MarketQuote>,
): {
  cashBalance: Money;
  reservedCash: Money;
  availableCash: Money;
  totalValue: Money;
  positions: ValuedPosition[];
} {
  const availability = calculateAccountAvailability(movements);
  const positionCosts = calculatePositionCosts(movements);
  const positions = valueOpenPositions(
    availability.positions,
    positionCosts,
    quotes,
  );
  const totalValue = positions.reduce(
    (currentTotal, position) => currentTotal.add(position.marketValue),
    availability.cashBalance,
  );

  return {
    cashBalance: availability.cashBalance,
    reservedCash: availability.reservedCash,
    availableCash: availability.availableCash,
    totalValue,
    positions,
  };
}

function valueOpenPositions(
  accountPositions: ReadonlyMap<number, AccountPositionAvailability>,
  positionCosts: ReadonlyMap<number, PositionCostState>,
  quotes: ReadonlyMap<number, MarketQuote>,
): ValuedPosition[] {
  return [...accountPositions].map(([instrumentId, accountPosition]) => {
    const quote = requireValuableQuote(instrumentId, quotes);

    const marketValue = quote.close.multiply(accountPosition.quantity);
    const costBasis = positionCosts.get(instrumentId)?.costBasis ?? null;

    return {
      instrumentId,
      quantity: accountPosition.quantity,
      reservedQuantity: accountPosition.reservedQuantity,
      availableQuantity: accountPosition.availableQuantity,
      marketPrice: quote.close,
      marketValue,
      costBasis,
      returnPercentage: calculatePercentageChange(marketValue, costBasis),
      dailyPriceChangePercentage: calculatePercentageChange(
        quote.close,
        quote.previousClose,
      ),
      quoteDate: quote.date,
    };
  });
}

function requireValuableQuote(
  instrumentId: number,
  quotes: ReadonlyMap<number, MarketQuote>,
): ValuableQuote {
  const quote = quotes.get(instrumentId);
  if (!isValuableQuote(quote)) {
    throw new PortfolioDataUnavailableError();
  }

  return quote;
}

function isValuableQuote(
  quote: MarketQuote | undefined,
): quote is ValuableQuote {
  return (
    quote !== undefined &&
    quote.close !== null &&
    !quote.close.isNegative() &&
    quote.date !== null
  );
}

function calculatePositionCosts(
  movements: readonly AccountMovement[],
): ReadonlyMap<number, PositionCostState> {
  const positionCosts = new Map<number, PositionCostState>();
  const executedMovements = getChronologicalExecutedMovements(movements);

  for (const movement of executedMovements) {
    if (movement.side !== OrderSide.BUY && movement.side !== OrderSide.SELL) {
      continue;
    }

    const currentState = positionCosts.get(movement.instrumentId) ?? {
      quantity: 0,
      costBasis: Money.zero(),
    };
    const nextState = applyTradeToPositionCost(currentState, movement);
    positionCosts.set(movement.instrumentId, nextState);
  }

  return positionCosts;
}

function getChronologicalExecutedMovements(
  movements: readonly AccountMovement[],
): AccountMovement[] {
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

  return executedMovements;
}

function applyTradeToPositionCost(
  currentState: PositionCostState,
  movement: AccountMovement,
): PositionCostState {
  const isBuy = movement.side === OrderSide.BUY;
  const quantityChange = isBuy ? movement.size : -movement.size;
  const nextQuantity = currentState.quantity + quantityChange;

  if (!isBuy && movement.size > currentState.quantity) {
    // Una sobreventa no permite reconstruir un costo long válido.
    return { quantity: nextQuantity, costBasis: null };
  }

  let nextCostBasis = currentState.costBasis;
  if (nextCostBasis !== null && movement.price !== null) {
    if (isBuy) {
      const purchaseCost = movement.price.multiply(movement.size);
      nextCostBasis = nextCostBasis.add(purchaseCost);
    } else {
      const remainingCost = nextCostBasis
        .toDecimal()
        .times(nextQuantity)
        .div(currentState.quantity);
      nextCostBasis = Money.from(remainingCost);
    }
  }

  if (nextQuantity === 0 && nextCostBasis !== null) {
    nextCostBasis = Money.zero();
  }

  return { quantity: nextQuantity, costBasis: nextCostBasis };
}
