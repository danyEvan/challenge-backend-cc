export class UserNotFoundError extends Error {
  constructor(message = 'User does not exist.') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}
