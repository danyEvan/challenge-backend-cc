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
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';
import { UserEntity } from '#src/shared/infrastructure/persistence/entities/user.entity.js';

describe('Order submission (HTTP and PostgreSQL)', () => {
  let app: INestApplication<App>;
  let instrumentRepository: Repository<InstrumentEntity>;
  let marketDataRepository: Repository<MarketDataEntity>;
  let orderRepository: Repository<OrderEntity>;
  let userRepository: Repository<UserEntity>;
  let stock: InstrumentEntity;
  let currency: InstrumentEntity;
  let functionalUser: UserEntity;
  let concurrentUser: UserEntity;
  let quote: MarketDataEntity;
  const marker = randomUUID().replaceAll('-', '').slice(0, 12);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApplication(app);
    await app.init();

    const dataSource = app.get(DataSource);
    instrumentRepository = dataSource.getRepository(InstrumentEntity);
    marketDataRepository = dataSource.getRepository(MarketDataEntity);
    orderRepository = dataSource.getRepository(OrderEntity);
    userRepository = dataSource.getRepository(UserEntity);

    [stock, currency] = await instrumentRepository.save([
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
    ]);
    [functionalUser, concurrentUser] = await userRepository.save([
      {
        email: `order-functional-${marker}@test.local`,
        accountNumber: `OF${marker}`,
      },
      {
        email: `order-concurrent-${marker}@test.local`,
        accountNumber: `OC${marker}`,
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
    ]);
  });

  afterAll(async () => {
    try {
      if (functionalUser && concurrentUser) {
        await orderRepository.delete({
          userId: In([functionalUser.id, concurrentUser.id]),
        });
        await userRepository.delete({
          id: In([functionalUser.id, concurrentUser.id]),
        });
      }
      if (quote) {
        await marketDataRepository.delete({ id: quote.id });
      }
      if (stock && currency) {
        await instrumentRepository.delete({ id: In([stock.id, currency.id]) });
      }
    } finally {
      await app?.close();
    }
  });

  it('persists a MARKET order with the evaluated values', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
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
      request(app.getHttpServer()).post('/orders').send({
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

  it('rejects a currency instrument without persisting an order', async () => {
    const before = await orderRepository.countBy({ userId: functionalUser.id });

    const response = await request(app.getHttpServer())
      .post('/orders')
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
