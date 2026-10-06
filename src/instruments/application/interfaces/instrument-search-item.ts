import type { InstrumentType } from '../../../shared/domain/trading/trading.types.js';

export interface InstrumentSearchItem {
  readonly id: number;
  readonly ticker: string | null;
  readonly name: string | null;
  readonly type: InstrumentType;
}
