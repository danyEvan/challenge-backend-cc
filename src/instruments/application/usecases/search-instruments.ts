import { InstrumentSearchRepository } from '../ports/instrument-search.repository.js';
import type { InstrumentSearchCriteria } from '../interfaces/instrument-search-criteria.js';
import type { InstrumentSearchPage } from '../interfaces/instrument-search-page.js';

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
