import type { AccountMovement } from '../../../shared/domain/account/account-movement.js';
import type { MarketQuote } from '../../../shared/domain/trading/market-quote.js';
import type { PortfolioInstrument } from './portfolio-instrument.js';

export interface PortfolioSnapshot {
  readonly movements: readonly AccountMovement[];
  readonly quotes: ReadonlyMap<number, MarketQuote>;
  readonly instruments: readonly PortfolioInstrument[];
}
