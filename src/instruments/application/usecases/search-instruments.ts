import { InstrumentSearchRepository } from '#src/instruments/application/ports/instrument-search.repository.js';
import type { InstrumentSearchCriteria } from '#src/instruments/application/interfaces/instrument-search-criteria.js';
import type { InstrumentSearchPage } from '#src/instruments/application/interfaces/instrument-search-page.js';

export class SearchInstruments {
  constructor(private readonly repository: InstrumentSearchRepository) {}

  async execute(
    criteria: InstrumentSearchCriteria,
  ): Promise<InstrumentSearchPage> {
    const items = await this.repository.search({
      ...criteria,
      search: criteria.search.trim(),
    });
    return { items, limit: criteria.limit, offset: criteria.offset };
  }
}
