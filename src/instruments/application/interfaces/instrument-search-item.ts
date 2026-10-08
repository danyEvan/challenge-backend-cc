import type { InstrumentType } from '#src/shared/domain/trading/trading.types.js';

export interface InstrumentSearchItem {
  readonly id: number;
  readonly ticker: string | null;
  readonly name: string | null;
  readonly type: InstrumentType;
  readonly lastClose: string | null;
  readonly quoteDate: string | null;
  readonly dailyPriceChangePercentage: string | null;
}
