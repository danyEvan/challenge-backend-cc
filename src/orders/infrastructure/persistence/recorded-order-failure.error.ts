export type RecordedOrderFailureCode =
  'MARKET_DATA_UNAVAILABLE' | 'INTERNAL_ERROR';

export class RecordedOrderFailureError extends Error {
  constructor(
    readonly code: RecordedOrderFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'RecordedOrderFailureError';
  }
}
