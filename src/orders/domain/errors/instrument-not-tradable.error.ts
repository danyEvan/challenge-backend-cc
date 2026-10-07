export class InstrumentNotTradableError extends Error {
  constructor(message = 'Instrument is not available for trading.') {
    super(message);
    this.name = 'InstrumentNotTradableError';
  }
}
