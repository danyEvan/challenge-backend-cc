import type { PortfolioSnapshot } from '../interfaces/portfolio-snapshot.js';

export abstract class PortfolioRepository {
  abstract loadSnapshot(userId: number): Promise<PortfolioSnapshot>;
}
