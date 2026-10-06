import type { AccountMovement } from '../../domain/account/account-movement.js';
import type { MarketQuote } from '../../domain/trading/market-quote.js';

// An abstract class also supplies a runtime token for dependency injection.
export abstract class TradingReader {
  abstract userExists(userId: number): Promise<boolean>;

  abstract findExecutedMovements(userId: number): Promise<AccountMovement[]>;

  // Instruments without a quote are absent; callers decide how to report it.
  abstract findLatestQuotes(
    instrumentIds: readonly number[],
  ): Promise<ReadonlyMap<number, MarketQuote>>;
}
