import type { PortfolioSnapshot } from '#src/portfolio/application/interfaces/portfolio-snapshot.js';

export abstract class PortfolioRepository {
  abstract loadSnapshot(userId: number): Promise<PortfolioSnapshot>;
}
