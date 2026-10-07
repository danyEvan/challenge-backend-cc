import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import { calculateAccountResources } from '#src/shared/domain/account/calculate-account-resources.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { TradingTypeOrmRepository } from '#src/shared/infrastructure/persistence/trading-typeorm.repository.js';
import type { PortfolioSnapshot } from '#src/portfolio/application/interfaces/portfolio-snapshot.js';
import { PortfolioRepository } from '#src/portfolio/application/ports/portfolio.repository.js';

export class PortfolioTypeOrmRepository extends PortfolioRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  loadSnapshot(userId: number): Promise<PortfolioSnapshot> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      const trading = new TradingTypeOrmRepository(manager);

      const movements = await trading.findExecutedMovements(userId);
      const resources = calculateAccountResources(movements);
      const instrumentIds = [...resources.positions.keys()];

      if (instrumentIds.length === 0) {
        return { movements, instruments: [], quotes: new Map() };
      }

      const instruments = await manager.getRepository(InstrumentEntity).find({
        where: { id: In(instrumentIds) },
        select: { id: true, ticker: true, name: true },
      });
      const quotes = await trading.findLatestQuotes(instrumentIds);

      return { movements, instruments, quotes };
    });
  }
}
