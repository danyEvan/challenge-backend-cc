import type { InstrumentSearchCriteria } from '#src/instruments/application/interfaces/instrument-search-criteria.js';
import type { InstrumentSearchItem } from '#src/instruments/application/interfaces/instrument-search-item.js';

export abstract class InstrumentSearchRepository {
  abstract search(
    criteria: InstrumentSearchCriteria,
  ): Promise<InstrumentSearchItem[]>;
}
