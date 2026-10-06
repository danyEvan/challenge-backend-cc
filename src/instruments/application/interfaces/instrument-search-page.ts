import type { InstrumentSearchItem } from './instrument-search-item.js';

export interface InstrumentSearchPage {
  readonly items: InstrumentSearchItem[];
  readonly limit: number;
  readonly offset: number;
}
