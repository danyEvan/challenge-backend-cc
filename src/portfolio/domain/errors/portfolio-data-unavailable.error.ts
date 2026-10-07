export class PortfolioDataUnavailableError extends Error {
  constructor() {
    super('Portfolio cannot be valued with the available data.');
    this.name = 'PortfolioDataUnavailableError';
  }
}
