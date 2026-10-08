import type { EntityManager } from 'typeorm';
import { IdempotencyRecordEntity } from './entities/idempotency-record.entity.js';

interface IdempotencyRequest {
  readonly operation: string;
  readonly scope: string;
  readonly key: string;
  readonly requestHash: string;
}

export type IdempotencyClaim =
  | { readonly kind: 'claimed'; readonly recordId: number }
  | {
      readonly kind: 'existing';
      readonly requestHash: string;
      readonly statusCode: number | null;
      readonly result: unknown;
    };

export class IdempotencyTypeOrmRepository {
  constructor(private readonly manager: EntityManager) {}

  async claim(request: IdempotencyRequest): Promise<IdempotencyClaim> {
    const repository = this.manager.getRepository(IdempotencyRecordEntity);
    const inserted = await repository
      .createQueryBuilder()
      .insert()
      .values(request)
      .orIgnore()
      .returning(['id'])
      .updateEntity(false)
      .execute();

    const insertedRow: unknown = Array.isArray(inserted.raw)
      ? inserted.raw[0]
      : undefined;
    if (
      insertedRow !== null &&
      typeof insertedRow === 'object' &&
      'id' in insertedRow &&
      typeof insertedRow.id === 'number'
    ) {
      return { kind: 'claimed', recordId: insertedRow.id };
    }

    const existing = await repository.findOneByOrFail({
      operation: request.operation,
      scope: request.scope,
      key: request.key,
    });

    return {
      kind: 'existing',
      requestHash: existing.requestHash,
      statusCode: existing.statusCode,
      result: existing.result,
    };
  }

  async complete(
    recordId: number,
    statusCode: number,
    result: object,
  ): Promise<void> {
    const updated = await this.manager
      .getRepository(IdempotencyRecordEntity)
      .createQueryBuilder()
      .update()
      .set({ statusCode, result })
      .where('id = :recordId AND result IS NULL', { recordId })
      .execute();

    if (updated.affected !== 1) {
      throw new Error('Idempotency record was not updated');
    }
  }
}
