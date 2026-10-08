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
    [functionalUser, concurrentUser, idempotentUser] =
      await userRepository.save([
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
    ]);
  });

  afterAll(async () => {
    try {
      if (functionalUser && concurrentUser && idempotentUser) {
        await idempotencyRepository.delete({
          operation: 'orders.submit',
          scope: In([
            `user:${functionalUser.id}`,
            `user:${concurrentUser.id}`,
            `user:${idempotentUser.id}`,
          ]),
        });
        await orderRepository.delete({
          userId: In([functionalUser.id, concurrentUser.id, idempotentUser.id]),
        });
        await userRepository.delete({
          id: In([functionalUser.id, concurrentUser.id, idempotentUser.id]),
        });
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
    expect(stored.result).toMatchObject(responses[0].body.data);
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

  it('stores and replays a confirmed service error without creating an order', async () => {
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

    const first = await submit()
      .expect(500)
      .expect('Idempotency-Outcome', 'finalized');
    expect(first.body.code).toBe('MARKET_DATA_UNAVAILABLE');

    recoveredQuote = await marketDataRepository.save({
      instrumentId: unquotedStock.id,
      high: '100.00',
      low: '100.00',
      open: '100.00',
      close: '100.00',
      previousClose: '100.00',
      date: '2023-07-14',
    });

    const replay = await submit()
      .expect(500)
      .expect('Idempotency-Outcome', 'finalized');
    expect(replay.body).toEqual(first.body);

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
      code: 'MARKET_DATA_UNAVAILABLE',
      detail: first.body.detail,
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

    await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: functionalUser.id,
        instrumentId: unquotedStock.id,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 1,
      })
      .expect(201);
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
