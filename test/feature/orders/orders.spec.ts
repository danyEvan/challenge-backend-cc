import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { setupApplication } from '#src/app.setup.js';
import { IdempotencyConflictError } from '#src/shared/infrastructure/idempotency/idempotency-conflict.error.js';
import { IdempotencyKeyContext } from '#src/shared/infrastructure/idempotency/idempotency-key.context.js';
import { InstrumentNotFoundError } from '#src/orders/domain/errors/instrument-not-found.error.js';
import { InstrumentNotTradableError } from '#src/orders/domain/errors/instrument-not-tradable.error.js';
import { InvalidOrderError } from '#src/orders/domain/errors/invalid-order.error.js';
import { MarketDataUnavailableError } from '#src/orders/domain/errors/market-data-unavailable.error.js';
import { UserNotFoundError } from '#src/orders/domain/errors/user-not-found.error.js';
import { RecordedOrderFailureError } from '#src/orders/infrastructure/persistence/recorded-order-failure.error.js';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';
import { OrdersModule } from '#src/orders/orders.module.js';
import { Money } from '#src/shared/domain/money/money.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

describe('Orders HTTP (without PostgreSQL)', () => {
  let app: INestApplication;
  let idempotencyKeyContext: IdempotencyKeyContext;
  const repository = {
    submitAtomically: vi.fn<OrderRepository['submitAtomically']>(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [OrdersModule],
    })
      .overrideProvider(OrderRepository)
      .useValue(repository)
      .compile();

    app = module.createNestApplication();
    app.useLogger(false);
    setupApplication(app);
    await app.init();
    idempotencyKeyContext = app.get(IdempotencyKeyContext);
  });

  beforeEach(() => {
    repository.submitAtomically.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => app.close());

  it('submits a valid MARKET BUY order and responds 201 with FILLED status', async () => {
    const idempotencyKey = randomUUID();
    repository.submitAtomically.mockImplementationOnce(async () => {
      expect(idempotencyKeyContext.get()).toBe(idempotencyKey);
      return {
        id: 101,
        userId: 1,
        instrumentId: 47,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        size: 5,
        price: Money.from('925.85'),
        status: OrderStatus.FILLED,
        datetime: new Date('2023-07-14T15:30:00.000Z'),
      };
    });

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        amount: '5000.00',
      })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        id: 101,
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 5,
        price: '925.85',
        status: 'FILLED',
        datetime: '2023-07-14T15:30:00.000Z',
      },
    });

    expect(repository.submitAtomically).toHaveBeenCalledOnce();
    const input = repository.submitAtomically.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      userId: 1,
      instrumentId: 47,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    });
    expect(input).not.toHaveProperty('idempotencyKey');
    expect(input?.amount?.toString()).toBe('5000.00');
  });

  it('submits an order with insufficient funds and responds 201 with REJECTED status', async () => {
    repository.submitAtomically.mockResolvedValueOnce({
      id: 102,
      userId: 1,
      instrumentId: 47,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      size: 100,
      price: Money.from('1000.00'),
      status: OrderStatus.REJECTED,
      datetime: new Date('2023-07-14T15:30:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        size: 100,
        price: '1000.00',
      })
      .expect(201);

    expect(response.body.data.status).toBe('REJECTED');
  });

  it('rejects an order resulting in 0 shares with 422 Problem Details', async () => {
    repository.submitAtomically.mockRejectedValueOnce(
      new InvalidOrderError(
        'Calculated share quantity must be at least 1 share',
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        amount: '100.00',
      })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'INVALID_ORDER',
      instance: '/orders',
    });
  });

  it('returns 404 Problem Details when user does not exist', async () => {
    repository.submitAtomically.mockRejectedValueOnce(new UserNotFoundError());

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 999999,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('returns 500 Problem Details when market quote is unavailable for MARKET order', async () => {
    repository.submitAtomically.mockRejectedValueOnce(
      new MarketDataUnavailableError(
        'Latest market quote is not available for this instrument',
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 99,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
      })
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('MARKET_DATA_UNAVAILABLE');
    expect(response.headers['idempotency-outcome']).toBeUndefined();
  });

  it('returns the recorded 500 as Problem Details', async () => {
    repository.submitAtomically.mockRejectedValueOnce(
      new RecordedOrderFailureError(
        'MARKET_DATA_UNAVAILABLE',
        'Latest market quote is not available for this instrument',
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 99,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
      })
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/)
      .expect('Idempotency-Outcome', 'finalized');

    expect(response.body.code).toBe('MARKET_DATA_UNAVAILABLE');
  });

  it('returns 409 when an idempotency key is reused with another request', async () => {
    repository.submitAtomically.mockRejectedValueOnce(
      new IdempotencyConflictError(),
    );

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(409)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('requires an idempotency key before submitting', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(repository.submitAtomically).not.toHaveBeenCalled();
  });

  it('rejects an invalid idempotency key before submitting', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', 'not-a-uuid')
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(repository.submitAtomically).not.toHaveBeenCalled();
  });

  it('maps missing and non-tradable instruments to controlled errors', async () => {
    repository.submitAtomically.mockRejectedValueOnce(
      new InstrumentNotFoundError(),
    );
    const missing = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 999999,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        price: '10.00',
      })
      .expect(404);
    expect(missing.body.code).toBe('NOT_FOUND');

    repository.submitAtomically.mockRejectedValueOnce(
      new InstrumentNotTradableError(),
    );
    const notTradable = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 66,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        price: '10.00',
      })
      .expect(422);
    expect(notTradable.body.code).toBe('INSTRUMENT_NOT_TRADABLE');
  });

  it.each([
    {
      name: 'both size and amount',
      body: { size: 10, amount: '5000.00' },
    },
    { name: 'neither size nor amount', body: {} },
    { name: 'sub-cent price', body: { size: 1, price: '0.001' } },
    { name: 'numeric price', body: { size: 1, price: 10 } },
    { name: 'null amount', body: { amount: null } },
    { name: 'size outside PostgreSQL INT', body: { size: 2147483648 } },
    { name: 'transfer side', body: { side: 'CASH_IN', size: 1 } },
    { name: 'client-assigned status', body: { size: 1, status: 'FILLED' } },
  ])('rejects $name before submitting', async ({ body }) => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', randomUUID())
      .send({
        userId: 1,
        instrumentId: 47,
        side: 'BUY',
        type: body.price === undefined ? 'MARKET' : 'LIMIT',
        ...body,
      })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(repository.submitAtomically).not.toHaveBeenCalled();
  });
});
