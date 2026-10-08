import type { EntityManager } from 'typeorm';
import { calculateAccountResources } from '#src/shared/domain/account/calculate-account-resources.js';
import type { MarketQuote } from '#src/shared/domain/trading/market-quote.js';
import {
  InstrumentType,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';
import { TradingTypeOrmRepository } from '#src/shared/infrastructure/persistence/trading-typeorm.repository.js';
import type { PersistedOrder } from '#src/orders/application/interfaces/persisted-order.js';
import type { OrderRequest } from '#src/orders/application/interfaces/order-request.js';
import { evaluateOrder } from '#src/orders/domain/evaluate-order.js';
import { InstrumentNotFoundError } from '#src/orders/domain/errors/instrument-not-found.error.js';
import { InstrumentNotTradableError } from '#src/orders/domain/errors/instrument-not-tradable.error.js';

export async function persistEvaluatedOrder(
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

  const movements = await tradingRepository.findExecutedMovements(input.userId);
  const accountResources = calculateAccountResources(movements);
  const availableShares =
    accountResources.positions.get(input.instrumentId) ?? 0;

  const evaluatedOrder = evaluateOrder({
    side: input.side,
    type: input.type,
    size: input.size,
    amount: input.amount,
    price: input.price,
    marketQuote,
    availableCash: accountResources.availableCash,
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
