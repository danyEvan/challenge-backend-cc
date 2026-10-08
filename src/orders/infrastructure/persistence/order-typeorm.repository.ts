import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { calculateAccountAvailability } from '#src/shared/domain/account/calculate-account-availability.js';
import { Money } from '#src/shared/domain/money/money.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import {
  InstrumentType,
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { IdempotencyConflictError } from '#src/shared/infrastructure/idempotency/idempotency-conflict.error.js';
import { IdempotencyKeyContext } from '#src/shared/infrastructure/idempotency/idempotency-key.context.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';
import { UserEntity } from '#src/shared/infrastructure/persistence/entities/user.entity.js';
import { IdempotencyTypeOrmRepository } from '#src/shared/infrastructure/persistence/idempotency-typeorm.repository.js';
import { TradingTypeOrmRepository } from '#src/shared/infrastructure/persistence/trading-typeorm.repository.js';
import type { OrderRequest } from '#src/orders/application/interfaces/order-request.js';
import type { PersistedOrder } from '#src/orders/application/interfaces/persisted-order.js';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';
import { evaluateOrder } from '#src/orders/domain/evaluate-order.js';
import { InvalidOrderError } from '#src/orders/domain/errors/invalid-order.error.js';
import { InstrumentNotFoundError } from '#src/orders/domain/errors/instrument-not-found.error.js';
import { InstrumentNotTradableError } from '#src/orders/domain/errors/instrument-not-tradable.error.js';
import { MarketDataUnavailableError } from '#src/orders/domain/errors/market-data-unavailable.error.js';
import { UserNotFoundError } from '#src/orders/domain/errors/user-not-found.error.js';
import {
  RecordedOrderFailureError,
  type RecordedOrderFailureCode,
} from './recorded-order-failure.error.js';

const IDEMPOTENCY_OPERATION = 'orders.submit';
const ORDER_SAVEPOINT = 'order_execution';

type SubmissionOutcome =
  | {
      readonly kind: 'order';
      readonly order: PersistedOrder;
      readonly created: boolean;
    }
  | { readonly kind: 'failure'; readonly error: RecordedOrderFailureError };

function isUnrecordedError(error: unknown): boolean {
  return (
    error instanceof InstrumentNotFoundError ||
    error instanceof InstrumentNotTradableError ||
    error instanceof InvalidOrderError ||
    error instanceof MarketDataUnavailableError
  );
}

function restoreRecordedFailure(result: unknown): RecordedOrderFailureError {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new Error('Idempotency result is not a recorded failure');
  }

  const failure = result as Record<string, unknown>;
  // Conservamos el replay de resultados confirmados antes de esta política.
  if (
    (failure.code !== 'MARKET_DATA_UNAVAILABLE' &&
      failure.code !== 'INTERNAL_ERROR') ||
    typeof failure.detail !== 'string'
  ) {
    throw new Error('Idempotency result contains an invalid failure');
  }

  return new RecordedOrderFailureError(
    failure.code as RecordedOrderFailureCode,
    failure.detail,
  );
}

function hashOrderRequest(input: OrderRequest): string {
  const normalizedRequest = JSON.stringify([
    input.userId,
    input.instrumentId,
    input.side,
    input.type,
    input.size ?? null,
    input.amount?.toString() ?? null,
    input.price?.toString() ?? null,
  ]);

  return createHash('sha256').update(normalizedRequest).digest('hex');
}

function restoreOrder(result: unknown): PersistedOrder {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new Error('Idempotency result is not an order');
  }

  const order = result as Record<string, unknown>;
  if (
    !Number.isSafeInteger(order.id) ||
    !Number.isSafeInteger(order.userId) ||
    !Number.isSafeInteger(order.instrumentId) ||
    !Number.isSafeInteger(order.size) ||
    (order.side !== OrderSide.BUY && order.side !== OrderSide.SELL) ||
    (order.type !== OrderType.MARKET && order.type !== OrderType.LIMIT) ||
    (order.status !== OrderStatus.NEW &&
      order.status !== OrderStatus.FILLED &&
      order.status !== OrderStatus.REJECTED) ||
    typeof order.price !== 'string' ||
    typeof order.datetime !== 'string'
  ) {
    throw new Error('Idempotency result contains incomplete order data');
  }

  const submittedAt = new Date(order.datetime);
  if (Number.isNaN(submittedAt.getTime())) {
    throw new Error('Idempotency result contains an invalid date');
  }
  return {
    id: order.id as number,
    userId: order.userId as number,
    instrumentId: order.instrumentId as number,
    side: order.side,
    type: order.type,
    size: order.size as number,
    price: Money.from(order.price),
    status: order.status,
    datetime: submittedAt,
  };
}

export class OrderTypeOrmRepository extends OrderRepository {
  private readonly logger = new Logger(OrderTypeOrmRepository.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly idempotencyKeyContext: IdempotencyKeyContext,
  ) {
    super();
  }

  async submitAtomically(input: OrderRequest): Promise<PersistedOrder> {
    const idempotencyKey = this.idempotencyKeyContext.get();
    const outcome = await this.dataSource.transaction(
      'READ COMMITTED',
      async (manager): Promise<SubmissionOutcome> => {
        // El lock serializa la cuenta y las lecturas siguientes ven el último commit.
        const user = await manager
          .getRepository(UserEntity)
          .createQueryBuilder('user')
          .select('user.id')
          .where('user.id = :userId', { userId: input.userId })
          .setLock('pessimistic_write')
          .getOne();

        if (!user) {
          throw new UserNotFoundError();
        }

        const idempotencyRepository = new IdempotencyTypeOrmRepository(manager);
        const requestHash = hashOrderRequest(input);
        const idempotency = await idempotencyRepository.claim({
          operation: IDEMPOTENCY_OPERATION,
          scope: `user:${input.userId}`,
          key: idempotencyKey,
          requestHash,
        });

        if (idempotency.kind === 'existing') {
          if (idempotency.requestHash !== requestHash) {
            throw new IdempotencyConflictError();
          }
          if (idempotency.statusCode === 201) {
            return {
              kind: 'order',
              order: restoreOrder(idempotency.result),
              created: false,
            };
          }
          if (idempotency.statusCode === 500) {
            return {
              kind: 'failure',
              error: restoreRecordedFailure(idempotency.result),
            };
          }
          throw new Error('Idempotency result contains an invalid status code');
        }

        // El savepoint conserva la clave y descarta cualquier escritura de una operación fallida.
        await manager.query(`SAVEPOINT ${ORDER_SAVEPOINT}`);
        let persistedOrder: PersistedOrder;
        try {
          persistedOrder = await this.evaluateAndPersistOrder(manager, input);
        } catch (error) {
          if (isUnrecordedError(error)) {
            throw error;
          }

          await manager.query(`ROLLBACK TO SAVEPOINT ${ORDER_SAVEPOINT}`);
          await manager.query(`RELEASE SAVEPOINT ${ORDER_SAVEPOINT}`);
          const failure = new RecordedOrderFailureError(
            'INTERNAL_ERROR',
            'An unexpected error occurred.',
          );
          await idempotencyRepository.complete(idempotency.recordId, 500, {
            code: failure.code,
            detail: failure.message,
          });
          return { kind: 'failure', error: failure };
        }

        await manager.query(`RELEASE SAVEPOINT ${ORDER_SAVEPOINT}`);
        await idempotencyRepository.complete(idempotency.recordId, 201, {
          id: persistedOrder.id,
          userId: persistedOrder.userId,
          instrumentId: persistedOrder.instrumentId,
          side: persistedOrder.side,
          type: persistedOrder.type,
          size: persistedOrder.size,
          price: persistedOrder.price.toString(),
          status: persistedOrder.status,
          datetime: persistedOrder.datetime.toISOString(),
        });

        return { kind: 'order', order: persistedOrder, created: true };
      },
    );

    if (outcome.kind === 'failure') {
      throw outcome.error;
    }

    if (outcome.created && outcome.order.status === OrderStatus.REJECTED) {
      const reason =
        outcome.order.side === OrderSide.BUY
          ? 'INSUFFICIENT_CASH'
          : 'INSUFFICIENT_SHARES';
      this.logger.log(
        `[orders.rejected] Order ${outcome.order.id} for user ${outcome.order.userId} on instrument ${outcome.order.instrumentId} was rejected: ${reason}`,
      );
    }

    return outcome.order;
  }

  private async evaluateAndPersistOrder(
    manager: EntityManager,
    input: OrderRequest,
  ): Promise<PersistedOrder> {
    const instrument = await manager.getRepository(InstrumentEntity).findOne({
      where: { id: input.instrumentId },
      select: { id: true, type: true },
    });
    if (!instrument) {
      throw new InstrumentNotFoundError();
    }
    if (instrument.type !== InstrumentType.STOCK) {
      throw new InstrumentNotTradableError();
    }

    const tradingRepository = new TradingTypeOrmRepository(manager);
    let marketQuote: MarketQuote | undefined;
    if (input.type === OrderType.MARKET) {
      const latestQuotes = await tradingRepository.findLatestQuotes([
        input.instrumentId,
      ]);
      marketQuote = latestQuotes.get(input.instrumentId);
    }

    const movements = await tradingRepository.findAvailabilityMovements(
      input.userId,
    );
    const availability = calculateAccountAvailability(movements);
    const availableShares =
      availability.positions.get(input.instrumentId)?.availableQuantity ?? 0;
    const evaluatedOrder = evaluateOrder({
      side: input.side,
      type: input.type,
      size: input.size,
      amount: input.amount,
      price: input.price,
      marketQuote,
      availableCash: availability.availableCash,
      availableShares,
    });

    const submittedAt = new Date();
    const orderEntity = manager.getRepository(OrderEntity).create({
      userId: input.userId,
      instrumentId: input.instrumentId,
      size: evaluatedOrder.size,
      price: evaluatedOrder.price.toString(),
      type: evaluatedOrder.type,
      side: evaluatedOrder.side,
      status: evaluatedOrder.status,
      datetime: submittedAt,
    });
    const saved = await manager.getRepository(OrderEntity).save(orderEntity);
    return {
      id: saved.id,
      userId: input.userId,
      instrumentId: input.instrumentId,
      side: evaluatedOrder.side,
      type: evaluatedOrder.type,
      size: evaluatedOrder.size,
      price: evaluatedOrder.price,
      status: evaluatedOrder.status,
      datetime: submittedAt,
    };
  }
}
