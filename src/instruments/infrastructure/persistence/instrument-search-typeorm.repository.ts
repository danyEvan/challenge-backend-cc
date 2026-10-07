import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstrumentSearchRepository } from '#src/instruments/application/ports/instrument-search.repository.js';
import type { InstrumentSearchCriteria } from '#src/instruments/application/interfaces/instrument-search-criteria.js';
import type { InstrumentSearchItem } from '#src/instruments/application/interfaces/instrument-search-item.js';
import { InstrumentType } from '#src/shared/domain/trading/trading.types.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';

@Injectable()
export class InstrumentSearchTypeOrmRepository extends InstrumentSearchRepository {
  constructor(
    @InjectRepository(InstrumentEntity)
    private readonly repository: Repository<InstrumentEntity>,
  ) {
    super();
  }

  async search(
    criteria: InstrumentSearchCriteria,
  ): Promise<InstrumentSearchItem[]> {
    const instruments = this.repository
      .createQueryBuilder('instrument')
      .select([
        'instrument.id',
        'instrument.ticker',
        'instrument.name',
        'instrument.type',
      ])
      .where('instrument.type = :instrumentType', {
        instrumentType: InstrumentType.STOCK,
      });

    if (criteria.search !== '') {
      // Escapamos los comodines para buscarlos como texto literal.
      const pattern = `%${criteria.search.replace(/[!%_]/g, '!$&')}%`;
      instruments.andWhere(
        "(instrument.ticker ILIKE :pattern ESCAPE '!' OR instrument.name ILIKE :pattern ESCAPE '!')",
        { pattern },
      );
    }

    const rows = await instruments
      .orderBy('instrument.ticker', 'ASC', 'NULLS LAST')
      .addOrderBy('instrument.id', 'ASC')
      .take(criteria.limit)
      .skip(criteria.offset)
      .getMany();

    return rows.map(({ id, ticker, name, type }) => ({
      id,
      ticker,
      name,
      type: type!, // Ajuste porque TypeORM devuelve el tipo como InstrumentType | null
    }));
  }
}
