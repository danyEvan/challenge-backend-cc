import type { PortfolioPosition } from './portfolio-position.js';

export interface PortfolioResult {
  readonly userId: number;
  readonly currency: 'ARS';
  readonly totalValue: string;
  readonly availableCash: string;
  readonly positions: PortfolioPosition[];
}
