import type { Decimal } from 'decimal.js';
import type { UserRepository } from '../../../shared/application/ports/user.repository.js';
import { calculatePortfolio } from '../../domain/calculate-portfolio.js';
import { PortfolioDataUnavailableError } from '../../domain/errors/portfolio-data-unavailable.error.js';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error.js';
import type { PortfolioResult } from '../interfaces/portfolio-result.js';
import type { PortfolioRepository } from '../ports/portfolio.repository.js';

function formatPercentage(value: Decimal | null): string | null {
  if (value === null) {
    return null;
  }

  const rounded = value.toDecimalPlaces(2);
  return rounded.isZero() ? '0.00' : rounded.toFixed(2);
}

export class GetPortfolio {
  constructor(
    private readonly repository: PortfolioRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: number): Promise<PortfolioResult> {
    const userExists = await this.userRepository.exists(userId);
    if (!userExists) {
      throw new UserNotFoundError();
    }

    const snapshot = await this.repository.loadSnapshot(userId);
    const portfolio = calculatePortfolio(snapshot.movements, snapshot.quotes);
    const instrumentsById = new Map(
      snapshot.instruments.map((instrument) => [instrument.id, instrument]),
    );
    const positions = portfolio.positions.map((position) => {
      const instrument = instrumentsById.get(position.instrumentId);
      if (!instrument) {
        throw new PortfolioDataUnavailableError();
      }

      return {
        instrumentId: position.instrumentId,
        ticker: instrument.ticker,
        name: instrument.name,
        quantity: position.quantity,
        marketPrice: position.marketPrice.toString(),
        marketValue: position.marketValue.toString(),
        costBasis: position.costBasis?.toString() ?? null,
        returnPercentage: formatPercentage(position.returnPercentage),
        dailyPriceChangePercentage: formatPercentage(
          position.dailyPriceChangePercentage,
        ),
        quoteDate: position.quoteDate,
      };
    });

    positions.sort((a, b) => {
      if (a.ticker === b.ticker) {
        return a.instrumentId - b.instrumentId;
      }
      if (a.ticker === null) {
        return 1;
      }
      if (b.ticker === null) {
        return -1;
      }
      return a.ticker < b.ticker ? -1 : 1;
    });

    return {
      userId,
      currency: 'ARS',
      totalValue: portfolio.totalValue.toString(),
      availableCash: portfolio.availableCash.toString(),
      positions,
    };
  }
}
