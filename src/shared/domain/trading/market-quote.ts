import type { Money } from '#src/shared/domain/money/money.js';

export type MarketQuote = Readonly<{
  instrumentId: number;
  close: Money | null;
  previousClose: Money | null;
  date: string | null;
}>;
