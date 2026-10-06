import type { Money } from '../money/money.js';

export type MarketQuote = Readonly<{
  instrumentId: number;
  close: Money;
  previousClose: Money | null;
  date: string;
}>;
