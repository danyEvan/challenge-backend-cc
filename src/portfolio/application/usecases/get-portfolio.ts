import type { UserRepository } from '#src/shared/application/ports/user.repository.js';
import { formatPercentage } from '#src/shared/domain/money/percentage-change.js';
import { calculatePortfolio } from '#src/portfolio/domain/calculate-portfolio.js';
import { PortfolioDataUnavailableError } from '#src/portfolio/domain/errors/portfolio-data-unavailable.error.js';
import { UserNotFoundError } from '#src/portfolio/domain/errors/user-not-found.error.js';
import type { PortfolioResult } from '#src/portfolio/application/interfaces/portfolio-result.js';
import type { PortfolioRepository } from '#src/portfolio/application/ports/portfolio.repository.js';

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
        reservedQuantity: position.reservedQuantity,
        availableQuantity: position.availableQuantity,
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
      cashBalance: portfolio.cashBalance.toString(),
      reservedCash: portfolio.reservedCash.toString(),
      availableCash: portfolio.availableCash.toString(),
      positions,
    };
  }
}
