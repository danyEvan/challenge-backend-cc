export class MarketDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataUnavailableError';
  }
}
