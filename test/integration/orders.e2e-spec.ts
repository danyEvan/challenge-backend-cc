import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '#src/app.module.js';
import { setupApplication } from '#src/app.setup.js';
import {
  InstrumentType,
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { MarketDataEntity } from '#src/shared/infrastructure/persistence/entities/market-data.entity.js';
import { IdempotencyRecordEntity } from '#src/shared/infrastructure/persistence/entities/idempotency-record.entity.js';
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';
import { UserEntity } from '#src/shared/infrastructure/persistence/entities/user.entity.js';

describe('Order submission (HTTP and PostgreSQL)', () => {
  let app: INestApplication<App>;
  let instrumentRepository: Repository<InstrumentEntity>;
  let marketDataRepository: Repository<MarketDataEntity>;
  let orderRepository: Repository<OrderEntity>;
  let idempotencyRepository: Repository<IdempotencyRecordEntity>;
  let userRepository: Repository<UserEntity>;
  let stock: InstrumentEntity;
  let currency: InstrumentEntity;
  let unquotedStock: InstrumentEntity;
  let functionalUser: UserEntity;
  let concurrentUser: UserEntity;
  let idempotentUser: UserEntity;
  let reservationBuyer: UserEntity;
  let reservationSeller: UserEntity;
  let quote: MarketDataEntity;
  let recoveredQuote: MarketDataEntity;
  const marker = randomUUID().replaceAll('-', '').slice(0, 12);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApplication(app);
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.runMigrations();
    instrumentRepository = dataSource.getRepository(InstrumentEntity);
    marketDataRepository = dataSource.getRepository(MarketDataEntity);
    orderRepository = dataSource.getRepository(OrderEntity);
    idempotencyRepository = dataSource.getRepository(IdempotencyRecordEntity);
    userRepository = dataSource.getRepository(UserEntity);

    [stock, currency, unquotedStock] = await instrumentRepository.save([
      {
        ticker: `O${marker.slice(0, 7)}`,
        name: `Order test stock ${marker}`,
        type: InstrumentType.STOCK,
      },
      {
        ticker: `C${marker.slice(0, 7)}`,
        name: `Order test cash ${marker}`,
        type: InstrumentType.CURRENCY,
      },
      {
        ticker: `N${marker.slice(0, 7)}`,
        name: `Order test stock without quote ${marker}`,
        type: InstrumentType.STOCK,
      },
    ]);
    [
      functionalUser,
      concurrentUser,
      idempotentUser,
      reservationBuyer,
      reservationSeller,
    ] = await userRepository.save([
      {
        email: `order-functional-${marker}@test.local`,
        accountNumber: `OF${marker}`,
      },
      {
        email: `order-concurrent-${marker}@test.local`,
        accountNumber: `OC${marker}`,
      },
      {
        email: `order-idempotent-${marker}@test.local`,
        accountNumber: `OI${marker}`,
      },
      {
        email: `order-reserved-buy-${marker}@test.local`,
        accountNumber: `OB${marker}`,
      },
      {
        email: `order-reserved-sell-${marker}@test.local`,
        accountNumber: `OS${marker}`,
      },
    ]);
    quote = await marketDataRepository.save({
      instrumentId: stock.id,
      high: '100.00',
      low: '100.00',
      open: '100.00',
      close: '100.00',
      previousClose: '100.00',
      date: '2023-07-14',
    });
    await orderRepository.save([
      {
        instrumentId: currency.id,
        userId: functionalUser.id,
        size: 1000,
        price: '1.00',
        type: OrderType.MARKET,
        side: OrderSide.CASH_IN,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:00:00.000Z'),
      },
      {
        instrumentId: currency.id,
        userId: concurrentUser.id,
        size: 100,
        price: '1.00',
        type: OrderType.MARKET,
        side: OrderSide.CASH_IN,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:00:00.000Z'),
      },
      {
        instrumentId: currency.id,
        userId: idempotentUser.id,
        size: 100,
        price: '1.00',
        type: OrderType.MARKET,
        side: OrderSide.CASH_IN,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:00:00.000Z'),
      },
      {
        instrumentId: currency.id,
        userId: reservationBuyer.id,
        size: 1000,
        price: '1.00',
        type: OrderType.MARKET,
        side: OrderSide.CASH_IN,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:00:00.000Z'),
      },
      {
        instrumentId: currency.id,
        userId: reservationSeller.id,
        size: 1000,
        price: '1.00',
        type: OrderType.MARKET,
        side: OrderSide.CASH_IN,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:00:00.000Z'),
      },
      {
        instrumentId: stock.id,
        userId: reservationSeller.id,
        size: 10,
        price: '100.00',
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-12T12:01:00.000Z'),
      },
    ]);
  });

  afterAll(async () => {
    try {
      if (
        functionalUser &&
        concurrentUser &&
        idempotentUser &&
        reservationBuyer &&
        reservationSeller
      ) {
        const userIds = [
          functionalUser.id,
          concurrentUser.id,
          idempotentUser.id,
          reservationBuyer.id,
          reservationSeller.id,
        ];
        await idempotencyRepository.delete({
          operation: 'orders.submit',
          scope: In(userIds.map((userId) => `user:${userId}`)),
        });
        await orderRepository.delete({
          userId: In(userIds),
        });
        await userRepository.delete({ id: In(userIds) });
      }
      if (quote) {
        await marketDataRepository.delete({ id: quote.id });
      }
      if (recoveredQuote) {
        await marketDataRepository.delete({ id: recoveredQuote.id });
      }
      if (stock && currency && unquotedStock) {
        await instrumentRepository.delete({
          id: In([stock.id, currency.id, unquotedStock.id]),
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('rejects a missing idempotency key without creating an order', async () => {
    const before = await orderRepository.countBy({ userId: functionalUser.id });

    await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: functionalUser.id,
        instrumentId: stock.id,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 1,
      })
      .expect(400);

    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(before);
  });

  it('persists a MARKET order with the evaluated values', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: functionalUser.id,
        instrumentId: stock.id,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 2,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      userId: functionalUser.id,
      instrumentId: stock.id,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      size: 2,
      price: '100.00',
      status: OrderStatus.FILLED,
    });
    expect(response.body.data).not.toHaveProperty('rejectionReason');

    const persisted = await orderRepository.findOneByOrFail({
      id: response.body.data.id as number,
    });
    expect(persisted).toMatchObject({
      userId: functionalUser.id,
      instrumentId: stock.id,
      size: 2,
      price: '100.00',
      status: OrderStatus.FILLED,
    });
  });

  it('serializes simultaneous orders and persists the second as REJECTED', async () => {
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', randomUUID())
        .send({
          userId: concurrentUser.id,
          instrumentId: stock.id,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          size: 1,
        });

    const responses = await Promise.all([
      submit().expect(201),
      submit().expect(201),
    ]);
    expect(
      responses
        .map(({ body }) => body.data.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual([OrderStatus.FILLED, OrderStatus.REJECTED]);
    const persisted = await orderRepository.findBy({
      id: In(responses.map(({ body }) => body.data.id as number)),
    });
    expect(
      persisted
        .map(({ status }) => status)
        .sort((left, right) => (left ?? '').localeCompare(right ?? '')),
    ).toEqual([OrderStatus.FILLED, OrderStatus.REJECTED]);
  });

  it('serializes simultaneous LIMIT buys against cash after reservations', async () => {
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', randomUUID())
        .send({
          userId: reservationBuyer.id,
          instrumentId: stock.id,
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          size: 6,
          price: '100.00',
        });

    const responses = await Promise.all([
      submit().expect(201),
      submit().expect(201),
    ]);
    expect(
      responses
        .map(({ body }) => body.data.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual([OrderStatus.NEW, OrderStatus.REJECTED]);
    const portfolio = await request(app.getHttpServer())
      .get(`/users/${reservationBuyer.id}/portfolio`)
      .expect(200);
    expect(portfolio.body.data).toMatchObject({
      cashBalance: '1000.00',
      reservedCash: '600.00',
      availableCash: '400.00',
    });
  });

  it('rejects a LIMIT sell that exceeds shares left after reservations', async () => {
    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: reservationSeller.id,
        instrumentId: stock.id,
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        size: 7,
        price: '110.00',
      })
      .expect(201);
    expect(first.body.data.status).toBe(OrderStatus.NEW);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: reservationSeller.id,
        instrumentId: stock.id,
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        size: 4,
        price: '110.00',
      })
      .expect(201);
    expect(second.body.data.status).toBe(OrderStatus.REJECTED);
    expect(second.body.data).not.toHaveProperty('rejectionReason');

    const portfolio = await request(app.getHttpServer())
      .get(`/users/${reservationSeller.id}/portfolio`)
      .expect(200);
    expect(portfolio.body.data.positions).toContainEqual(
      expect.objectContaining({
        instrumentId: stock.id,
        quantity: 10,
        reservedQuantity: 7,
        availableQuantity: 3,
      }),
    );
  });

  it('returns one order for simultaneous requests with the same idempotency key', async () => {
    const idempotencyKey = randomUUID();
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          userId: idempotentUser.id,
          instrumentId: stock.id,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          size: 1,
        });

    const responses = await Promise.all([
      submit().expect(201),
      submit().expect(201),
    ]);
    const orderIds = responses.map(({ body }) => body.data.id as number);

    expect(new Set(orderIds).size).toBe(1);
    await expect(
      idempotencyRepository.countBy({
        operation: 'orders.submit',
        scope: `user:${idempotentUser.id}`,
        key: idempotencyKey,
      }),
    ).resolves.toBe(1);
    const stored = await idempotencyRepository.findOneByOrFail({
      operation: 'orders.submit',
      scope: `user:${idempotentUser.id}`,
      key: idempotencyKey,
    });
    expect(stored.result).toMatchObject({
      id: responses[0].body.data.id,
      status: OrderStatus.FILLED,
    });
    expect(stored.statusCode).toBe(201);
    await expect(orderRepository.countBy({ id: orderIds[0] })).resolves.toBe(1);
  });

  it('replays a persisted REJECTED order with the same key', async () => {
    const idempotencyKey = randomUUID();
    const before = await orderRepository.countBy({ userId: idempotentUser.id });
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          userId: idempotentUser.id,
          instrumentId: stock.id,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          size: 1000,
        });

    const created = await submit().expect(201);
    const replay = await submit().expect(201);

    expect(created.body.data.status).toBe(OrderStatus.REJECTED);
    expect(created.body.data).not.toHaveProperty('rejectionReason');
    expect(replay.body).toEqual(created.body);
    await expect(
      orderRepository.countBy({ userId: idempotentUser.id }),
    ).resolves.toBe(before + 1);
    await expect(
      idempotencyRepository.countBy({
        operation: 'orders.submit',
        scope: `user:${idempotentUser.id}`,
        key: idempotencyKey,
      }),
    ).resolves.toBe(1);
  });

  it('retries a MARKET order with the same key after its quote becomes available', async () => {
    const idempotencyKey = randomUUID();
    const before = await orderRepository.countBy({ userId: functionalUser.id });
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          userId: functionalUser.id,
          instrumentId: unquotedStock.id,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          size: 1,
        });

    const first = await submit().expect(500);
    expect(first.body.code).toBe('MARKET_DATA_UNAVAILABLE');
    expect(first.headers['idempotency-outcome']).toBeUndefined();
    await expect(
      idempotencyRepository.countBy({
        operation: 'orders.submit',
        scope: `user:${functionalUser.id}`,
        key: idempotencyKey,
      }),
    ).resolves.toBe(0);
    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(before);

    recoveredQuote = await marketDataRepository.save({
      instrumentId: unquotedStock.id,
      high: '100.00',
      low: '100.00',
      open: '100.00',
      close: '100.00',
      previousClose: '100.00',
      date: '2023-07-14',
    });

    const created = await submit().expect(201);
    expect(created.body.data).toMatchObject({
      userId: functionalUser.id,
      instrumentId: unquotedStock.id,
      size: 1,
      price: '100.00',
      status: OrderStatus.FILLED,
    });
    const replay = await submit().expect(201);
    expect(replay.body).toEqual(created.body);

    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(before + 1);
    const stored = await idempotencyRepository.findOneByOrFail({
      operation: 'orders.submit',
      scope: `user:${functionalUser.id}`,
      key: idempotencyKey,
    });
    expect(stored.statusCode).toBe(201);
    expect(stored.result).toMatchObject({
      id: created.body.data.id,
      status: OrderStatus.FILLED,
    });

    await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        userId: functionalUser.id,
        instrumentId: unquotedStock.id,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 2,
      })
      .expect(409);
  });

  it('keeps an unexpected confirmed failure replayable after its cause is removed', async () => {
    const idempotencyKey = randomUUID();
    const before = await orderRepository.countBy({ userId: functionalUser.id });
    const invalidPending = await orderRepository.save({
      userId: functionalUser.id,
      instrumentId: stock.id,
      size: 1,
      price: null,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      status: OrderStatus.NEW,
      datetime: new Date(),
    });
    const submit = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          userId: functionalUser.id,
          instrumentId: stock.id,
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          size: 1,
          price: '100.00',
        });

    let firstBody: unknown;
    try {
      const first = await submit()
        .expect(500)
        .expect('Idempotency-Outcome', 'finalized');
      expect(first.body.code).toBe('INTERNAL_ERROR');
      firstBody = first.body;
      await expect(
        orderRepository.countBy({ userId: functionalUser.id }),
      ).resolves.toBe(before + 1);
    } finally {
      await orderRepository.delete({ id: invalidPending.id });
    }

    const replay = await submit()
      .expect(500)
      .expect('Idempotency-Outcome', 'finalized');
    expect(replay.body).toEqual(firstBody);
    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(before);
    const stored = await idempotencyRepository.findOneByOrFail({
      operation: 'orders.submit',
      scope: `user:${functionalUser.id}`,
      key: idempotencyKey,
    });
    expect(stored.statusCode).toBe(500);
    expect(stored.result).toEqual({
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
  });

  it('returns 409 when the same key is reused with a different payload', async () => {
    const idempotencyKey = randomUUID();
    const previousOrders = await orderRepository.countBy({
      userId: functionalUser.id,
    });
    const requestBody = {
      userId: functionalUser.id,
      instrumentId: stock.id,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      size: 1,
      price: '90.00',
    };

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(requestBody)
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...requestBody, price: '90' })
      .expect(201);

    expect(replay.body).toEqual(created.body);

    const conflict = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({ ...requestBody, size: 2 })
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/);

    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(previousOrders + 1);
  });

  it('rejects a currency instrument without persisting an order', async () => {
    const before = await orderRepository.countBy({ userId: functionalUser.id });

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: functionalUser.id,
        instrumentId: currency.id,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        size: 1,
        price: '1.00',
      })
      .expect(422);

    expect(response.body.code).toBe('INSTRUMENT_NOT_TRADABLE');
    await expect(
      orderRepository.countBy({ userId: functionalUser.id }),
    ).resolves.toBe(before);
  });
});
