import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { TradingRepository } from '#src/shared/application/ports/trading.repository.js';
import { Money } from '#src/shared/domain/money/money.js';
import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import { OrderStatus } from '#src/shared/domain/trading/trading.types.js';
import { InvalidAccountHistoryError } from '#src/shared/domain/account/errors/invalid-account-history.error.js';
import { MarketDataEntity } from '#src/shared/infrastructure/persistence/entities/market-data.entity.js';
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';

export class TradingTypeOrmRepository extends TradingRepository {
  // El consumidor decide el alcance transaccional del manager.
  constructor(private readonly manager: EntityManager) {
    super();
  }

  async findAvailabilityMovements(userId: number): Promise<AccountMovement[]> {
    const rows = await this.manager.getRepository(OrderEntity).find({
      where: {
        userId,
        status: In([OrderStatus.FILLED, OrderStatus.NEW]),
      },
      select: {
        id: true,
        instrumentId: true,
        size: true,
        price: true,
        side: true,
        status: true,
        type: true,
        datetime: true,
      },
      order: { datetime: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => {
      if (
        row.instrumentId === null ||
        row.size === null ||
        row.side === null ||
        (row.status !== OrderStatus.FILLED && row.status !== OrderStatus.NEW) ||
        row.datetime === null ||
        !Number.isFinite(row.datetime.getTime())
      ) {
        throw new InvalidAccountHistoryError(
          'Account movement has missing or invalid fields',
        );
      }
      let price: Money | null;
      try {
        price = row.price === null ? null : Money.from(row.price);
      } catch {
        throw new InvalidAccountHistoryError(
          'Account movement price is invalid',
        );
      }
      return {
        id: row.id,
        instrumentId: row.instrumentId,
        size: row.size,
        price,
        side: row.side,
        status: row.status,
        type: row.type,
        datetime: row.datetime,
      };
    });
  }

  async findLatestQuotes(
    instrumentIds: readonly number[],
  ): Promise<ReadonlyMap<number, MarketQuote>> {
    if (instrumentIds.length === 0) {
      return new Map();
    }

    const rows = await this.manager
      .getRepository(MarketDataEntity)
      .createQueryBuilder('quote')
      .select([
        'quote.id',
        'quote.instrumentId',
        'quote.close',
        'quote.previousClose',
        'quote.date',
      ])
      .distinctOn(['quote.instrumentId'])
      .where('quote.instrumentId IN (:...instrumentIds)', {
        instrumentIds: [...new Set(instrumentIds)],
      })
      .orderBy('quote.instrumentId', 'ASC')
      .addOrderBy('quote.date', 'DESC', 'NULLS LAST')
      .addOrderBy('quote.id', 'DESC')
      .getMany();

    const quotes = new Map<number, MarketQuote>();
    for (const row of rows) {
      if (row.instrumentId === null) {
        continue;
      }

      quotes.set(row.instrumentId, {
        instrumentId: row.instrumentId,
        close: row.close === null ? null : Money.from(row.close),
        previousClose:
          row.previousClose === null ? null : Money.from(row.previousClose),
        date: row.date,
      });
    }
    return quotes;
  }
}
