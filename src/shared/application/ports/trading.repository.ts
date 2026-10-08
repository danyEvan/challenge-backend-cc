import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';

export abstract class TradingRepository {
  abstract findAvailabilityMovements(
    userId: number,
  ): Promise<AccountMovement[]>;

  // Si falta cotización, el caso de uso decide cómo informarlo
  abstract findLatestQuotes(
    instrumentIds: readonly number[],
  ): Promise<ReadonlyMap<number, MarketQuote>>;
}
