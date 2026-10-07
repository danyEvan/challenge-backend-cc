export class InstrumentNotFoundError extends Error {
  constructor(message = 'Instrument does not exist.') {
    super(message);
    this.name = 'InstrumentNotFoundError';
  }
}
