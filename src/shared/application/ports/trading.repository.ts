import type { AccountMovement } from '../../domain/account/account-movement.js';
import type { MarketQuote } from '../../domain/trading/market-quote.js';

export abstract class TradingRepository {
  abstract userExists(userId: number): Promise<boolean>;

  abstract findExecutedMovements(userId: number): Promise<AccountMovement[]>;

  // Si falta cotización, el caso de uso decide cómo informarlo
  abstract findLatestQuotes(
    instrumentIds: readonly number[],
  ): Promise<ReadonlyMap<number, MarketQuote>>;
}
