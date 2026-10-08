import 'reflect-metadata';
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
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { setupApplication } from '#src/app.setup.js';
import { PortfolioRepository } from '#src/portfolio/application/ports/portfolio.repository.js';
import type { PortfolioSnapshot } from '#src/portfolio/application/interfaces/portfolio-snapshot.js';
import { PortfolioModule } from '#src/portfolio/portfolio.module.js';
import { Money } from '#src/shared/domain/money/money.js';
import { UserRepository } from '#src/shared/application/ports/user.repository.js';
import type { AccountMovement } from '#src/shared/domain/account/account-movement.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

function movement(
  id: number,
  instrumentId: number,
  side: AccountMovement['side'],
  size: number,
  price: string | null,
): AccountMovement {
  return {
    id,
    instrumentId,
    side,
    size,
    price: price === null ? null : Money.from(price),
    status: OrderStatus.FILLED,
    type: OrderType.MARKET,
    datetime: new Date('2023-07-12T12:00:00Z'),
  };
}

function seedSnapshot(): PortfolioSnapshot {
  return {
    movements: [
      movement(1, 66, OrderSide.CASH_IN, 1000000, null),
      movement(2, 66, OrderSide.CASH_OUT, 100000, null),
      movement(3, 47, OrderSide.BUY, 50, '930'),
      movement(4, 31, OrderSide.BUY, 20, '1540'),
      movement(5, 47, OrderSide.SELL, 10, '940'),
      movement(6, 31, OrderSide.SELL, 30, '1530'),
      { ...movement(7, 54, OrderSide.BUY, 500, '250'), type: OrderType.LIMIT },
      {
        ...movement(8, 45, OrderSide.BUY, 50, '710'),
        status: OrderStatus.NEW,
        type: OrderType.LIMIT,
      },
      {
        ...movement(9, 31, OrderSide.BUY, 60, '1500'),
        status: OrderStatus.NEW,
        type: OrderType.LIMIT,
      },
    ],
    instruments: [
      { id: 47, ticker: 'PAMP', name: 'Pampa Holding' },
      { id: 31, ticker: 'BMA', name: 'Banco Macro' },
      { id: 54, ticker: 'METR', name: 'Metrogas' },
    ],
    quotes: new Map([
      [
        47,
        {
          instrumentId: 47,
          close: Money.from('925.85'),
          previousClose: Money.from('921.80'),
          date: '2023-07-14',
        },
      ],
      [
        31,
        {
          instrumentId: 31,
          close: Money.from('1502.80'),
          previousClose: Money.from('1520.25'),
          date: '2023-07-14',
        },
      ],
      [
        54,
        {
          instrumentId: 54,
          close: Money.from('229.50'),
          previousClose: Money.from('232'),
          date: '2023-07-14',
        },
      ],
    ]),
  };
}

describe('Portfolio HTTP (without PostgreSQL)', () => {
  let app: INestApplication<App>;
  const repository = {
    loadSnapshot: vi.fn<PortfolioRepository['loadSnapshot']>(),
  };
  const userRepository = {
    exists: vi.fn<UserRepository['exists']>(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PortfolioModule],
    })
      .overrideProvider(PortfolioRepository)
      .useValue(repository)
      .overrideProvider(UserRepository)
      .useValue(userRepository)
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    setupApplication(app);
    await app.init();
  });

  beforeEach(() => {
    repository.loadSnapshot.mockReset().mockResolvedValue(seedSnapshot());
    userRepository.exists.mockReset().mockResolvedValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => app.close());

  it('returns the complete signed seed valuation and logs the negative position', async () => {
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const response = await request(app.getHttpServer())
      .get('/users/1/portfolio')
      .expect(200);
    expect(response.body).toEqual({
      data: {
        userId: 1,
        currency: 'ARS',
        totalValue: '889756.00',
        cashBalance: '753000.00',
        reservedCash: '125500.00',
        availableCash: '627500.00',
        positions: [
          {
            instrumentId: 31,
            ticker: 'BMA',
            name: 'Banco Macro',
            quantity: -10,
            reservedQuantity: 0,
            availableQuantity: 0,
            marketPrice: '1502.80',
            marketValue: '-15028.00',
            costBasis: null,
            returnPercentage: null,
            dailyPriceChangePercentage: '-1.15',
            quoteDate: '2023-07-14',
          },
          {
            instrumentId: 54,
            ticker: 'METR',
            name: 'Metrogas',
            quantity: 500,
            reservedQuantity: 0,
            availableQuantity: 500,
            marketPrice: '229.50',
            marketValue: '114750.00',
            costBasis: '125000.00',
            returnPercentage: '-8.20',
            dailyPriceChangePercentage: '-1.08',
            quoteDate: '2023-07-14',
          },
          {
            instrumentId: 47,
            ticker: 'PAMP',
            name: 'Pampa Holding',
            quantity: 40,
            reservedQuantity: 0,
            availableQuantity: 40,
            marketPrice: '925.85',
            marketValue: '37034.00',
            costBasis: '37200.00',
            returnPercentage: '-0.45',
            dailyPriceChangePercentage: '0.44',
            quoteDate: '2023-07-14',
          },
        ],
      },
    });
    expect(repository.loadSnapshot).toHaveBeenCalledWith(1);
    expect(userRepository.exists).toHaveBeenCalledWith(1);
    expect(warning).toHaveBeenCalledWith(
      '[portfolio.negative_position] User 1 has negative position on instrument 31: -10 shares',
    );
  });

  it('distinguishes an empty account from a nonexistent user', async () => {
    repository.loadSnapshot.mockResolvedValueOnce({
      movements: [],
      instruments: [],
      quotes: new Map(),
    });
    const empty = await request(app.getHttpServer())
      .get('/users/2/portfolio')
      .expect(200);
    expect(empty.body).toEqual({
      data: {
        userId: 2,
        currency: 'ARS',
        totalValue: '0.00',
        cashBalance: '0.00',
        reservedCash: '0.00',
        availableCash: '0.00',
        positions: [],
      },
    });
    repository.loadSnapshot.mockClear();
    userRepository.exists.mockResolvedValueOnce(false);
    const missing = await request(app.getHttpServer())
      .get('/users/2147483647/portfolio')
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);
    expect(missing.body).toMatchObject({
      code: 'NOT_FOUND',
      instance: '/users/2147483647/portfolio',
    });
    expect(userRepository.exists).toHaveBeenLastCalledWith(2147483647);
    expect(repository.loadSnapshot).not.toHaveBeenCalled();
  });

  it('rejects invalid user IDs and query parameters before reading data', async () => {
    for (const path of [
      '/users/0/portfolio',
      '/users/1.5/portfolio',
      '/users/1/portfolio?limit=10',
    ]) {
      const response = await request(app.getHttpServer()).get(path).expect(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    }
    expect(repository.loadSnapshot).not.toHaveBeenCalled();
    expect(userRepository.exists).not.toHaveBeenCalled();
  });

  it('reports unavailable valuation and invalid history with controlled errors', async () => {
    repository.loadSnapshot.mockResolvedValueOnce({
      ...seedSnapshot(),
      quotes: new Map(),
    });
    const unpriced = await request(app.getHttpServer())
      .get('/users/1/portfolio')
      .expect(500);
    expect(unpriced.body.code).toBe('PORTFOLIO_DATA_UNAVAILABLE');
    repository.loadSnapshot.mockResolvedValueOnce({
      ...seedSnapshot(),
      movements: [movement(1, 47, OrderSide.BUY, 1, null)],
    });
    const invalid = await request(app.getHttpServer())
      .get('/users/1/portfolio')
      .expect(500);
    expect(invalid.body.code).toBe('INVALID_ACCOUNT_HISTORY');
  });

  it('does not expose persistence details on an unexpected failure', async () => {
    repository.loadSnapshot.mockRejectedValueOnce(
      new Error('SQL and private connection details'),
    );
    const response = await request(app.getHttpServer())
      .get('/users/1/portfolio')
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/);
    expect(response.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toContain('SQL');
  });
});
