export class InvalidAccountHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAccountHistoryError';
  }
}
