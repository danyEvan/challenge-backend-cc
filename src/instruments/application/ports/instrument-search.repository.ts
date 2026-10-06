import type { InstrumentSearchCriteria } from '../interfaces/instrument-search-criteria.js';
import type { InstrumentSearchItem } from '../interfaces/instrument-search-item.js';

export abstract class InstrumentSearchRepository {
  abstract search(
    criteria: InstrumentSearchCriteria,
  ): Promise<InstrumentSearchItem[]>;
}
