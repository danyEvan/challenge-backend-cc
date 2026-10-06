import type { EntityManager } from 'typeorm';
import { TradingRepository } from '../../application/ports/trading.repository.js';
import { Money } from '../../domain/money/money.js';
import type { AccountMovement } from '../../domain/account/account-movement.js';
import type { MarketQuote } from '../../domain/trading/market-quote.js';
import { OrderStatus } from '../../domain/trading/trading.types.js';
import { MarketDataEntity } from './entities/market-data.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { UserEntity } from './entities/user.entity.js';

export class TradingTypeOrmRepository extends TradingRepository {
  // Usamos el mismo manager para leer, bloquear y guardar la orden.
  constructor(private readonly manager: EntityManager) {
    super();
  }

  userExists(userId: number): Promise<boolean> {
    return this.manager.getRepository(UserEntity).existsBy({ id: userId });
  }

  async findExecutedMovements(userId: number): Promise<AccountMovement[]> {
    const rows = await this.manager.getRepository(OrderEntity).find({
      where: { userId, status: OrderStatus.FILLED },
      order: { datetime: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      instrumentId: row.instrumentId,
      size: row.size,
      price: row.price == null ? null : Money.from(row.price),
      side: row.side,
      status: row.status,
      type: row.type,
      datetime: row.datetime,
    }));
  }

  async findLatestQuotes(
    instrumentIds: readonly number[],
  ): Promise<ReadonlyMap<number, MarketQuote>> {
    if (instrumentIds.length === 0) return new Map();

    const rows = await this.manager
      .getRepository(MarketDataEntity)
      .createQueryBuilder('quote')
      .distinctOn(['quote.instrumentId'])
      .where('quote.instrumentId IN (:...instrumentIds)', {
        instrumentIds: [...new Set(instrumentIds)],
      })
      .orderBy('quote.instrumentId', 'ASC')
      .addOrderBy('quote.date', 'DESC', 'NULLS LAST')
      .addOrderBy('quote.id', 'DESC')
      .getMany();

    return new Map(
      rows.map((row) => [
        row.instrumentId,
        {
          instrumentId: row.instrumentId,
          close: Money.from(row.close),
          previousClose:
            row.previousClose == null ? null : Money.from(row.previousClose),
          date: row.date,
        },
      ]),
    );
  }
}
