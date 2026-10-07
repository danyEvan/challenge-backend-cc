import type { EntityManager } from 'typeorm';
import { UserRepository } from '#src/shared/application/ports/user.repository.js';
import { UserEntity } from '#src/shared/infrastructure/persistence/entities/user.entity.js';

export class UserTypeOrmRepository extends UserRepository {
  constructor(private readonly manager: EntityManager) {
    super();
  }

  exists(userId: number): Promise<boolean> {
    return this.manager.getRepository(UserEntity).existsBy({ id: userId });
  }
}
