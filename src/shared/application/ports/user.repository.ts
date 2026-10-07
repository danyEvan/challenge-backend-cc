export abstract class UserRepository {
  abstract exists(userId: number): Promise<boolean>;
}
