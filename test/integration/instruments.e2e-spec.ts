import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '#src/app.module.js';
import { setupApplication } from '#src/app.setup.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { MarketDataEntity } from '#src/shared/infrastructure/persistence/entities/market-data.entity.js';
import { InstrumentType } from '#src/shared/domain/trading/trading.types.js';
import { InstrumentSearchRepository } from '#src/instruments/application/ports/instrument-search.repository.js';

describe('Instrument search (HTTP and PostgreSQL)', () => {
  let app: INestApplication<App>;
  let repository: Repository<InstrumentEntity>;
  let marketDataRepository: Repository<MarketDataEntity>;
  let fixtures: InstrumentEntity[] = [];
  let quoteFixtures: MarketDataEntity[] = [];
  const marker = `search-e2e-${randomUUID()}`;

  function expectedItem(fixture: InstrumentEntity) {
    const quote =
      fixture.id === fixtures[0]?.id
        ? {
            lastClose: '12.50',
            quoteDate: '2023-07-14',
            dailyPriceChangePercentage: '25.00',
          }
        : fixture.id === fixtures[1]?.id
          ? {
              lastClose: '7.50',
              quoteDate: '2023-07-14',
              dailyPriceChangePercentage: null,
            }
          : fixture.id === fixtures[3]?.id
            ? {
                lastClose: '5.00',
                quoteDate: null,
                dailyPriceChangePercentage: null,
              }
            : {
                lastClose: null,
                quoteDate: null,
                dailyPriceChangePercentage: null,
              };

    return {
      id: fixture.id,
      ticker: fixture.ticker,
      name: fixture.name,
      type: fixture.type,
      ...quote,
    };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApplication(app);
    await app.init();
    repository = app.get(DataSource).getRepository(InstrumentEntity);
    marketDataRepository = app.get(DataSource).getRepository(MarketDataEntity);
    fixtures = await repository.save([
      { ticker: 'TSTAA', name: `${marker} 100%`, type: InstrumentType.STOCK },
      { ticker: 'TSTAA', name: `${marker} 1000`, type: InstrumentType.STOCK },
      {
        ticker: 'TSTAB',
        name: `${marker} currency`,
        type: InstrumentType.CURRENCY,
      },
      { ticker: null, name: `${marker} nullable`, type: InstrumentType.STOCK },
      { ticker: 'TSTZZ', name: null, type: InstrumentType.STOCK },
      { ticker: 'TSTNC', name: `${marker} unclassified`, type: null },
    ]);
    quoteFixtures = await marketDataRepository.save([
      {
        instrumentId: fixtures[0]!.id,
        close: '10.00',
        previousClose: '8.00',
        date: '2023-07-13',
      },
      {
        instrumentId: fixtures[0]!.id,
        close: '12.50',
        previousClose: '10.00',
        date: '2023-07-14',
      },
      {
        instrumentId: fixtures[1]!.id,
        close: '7.50',
        previousClose: null,
        date: '2023-07-14',
      },
      {
        instrumentId: fixtures[3]!.id,
        close: '5.00',
        previousClose: '4.00',
        date: null,
      },
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    try {
      if (quoteFixtures.length > 0) {
        await marketDataRepository.delete({
          id: In(quoteFixtures.map(({ id }) => id)),
        });
      }
      if (fixtures.length > 0) {
        await repository.delete({ id: In(fixtures.map(({ id }) => id)) });
      }
    } finally {
      await app?.close();
    }
  });

  it('matches ticker substrings regardless of case, whitespace or a null name', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: '  sTzZ  ' })
      .expect(200);

    expect(response.body).toEqual({
      data: [expectedItem(fixtures[4]!)],
      meta: { limit: 20, offset: 0 },
    });
  });

  it('matches tradable names and preserves nullable fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: marker.toUpperCase() })
      .expect(200);

    expect(response.body.data).toEqual([
      expectedItem(fixtures[0]!),
      expectedItem(fixtures[1]!),
      expectedItem(fixtures[3]!),
    ]);
    expect(response.body.data.at(-1)).toMatchObject({
      ticker: null,
      type: InstrumentType.STOCK,
      lastClose: '5.00',
      quoteDate: null,
    });
  });

  it('exposes the historical GGAL close and daily change from the provided seed', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: 'GGAL' })
      .expect(200);

    expect(response.body.data).toContainEqual(
      expect.objectContaining({
        id: 34,
        lastClose: '885.80',
        quoteDate: '2023-07-14',
        dailyPriceChangePercentage: '-3.48',
      }),
    );
  });

  it('excludes currency and unclassified instruments from every search', async () => {
    for (const search of ['ARS', 'PESOS', 'TSTAB', 'TSTNC']) {
      const response = await request(app.getHttpServer())
        .get('/instruments')
        .query({ search })
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { limit: 20, offset: 0 },
      });
    }
  });

  it('paginates in ticker/id order, including duplicate tickers', async () => {
    const first = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: marker, limit: 2, offset: 0 })
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: marker, limit: 2, offset: 2 })
      .expect(200);

    expect(first.body).toEqual({
      data: fixtures.slice(0, 2).map(expectedItem),
      meta: { limit: 2, offset: 0 },
    });
    expect(second.body).toEqual({
      data: [expectedItem(fixtures[3]!)],
      meta: { limit: 2, offset: 2 },
    });
  });

  it('treats % as literal search text', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: `${marker} 100%` })
      .expect(200);

    expect(response.body.data).toEqual([expectedItem(fixtures[0]!)]);
  });

  it('lists a bounded catalog by default and handles blank search equivalently', async () => {
    const missing = await request(app.getHttpServer())
      .get('/instruments')
      .expect(200);
    const blank = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: '   ' })
      .expect(200);

    expect(missing.body).toMatchObject({ meta: { limit: 20, offset: 0 } });
    expect(missing.body.data).toHaveLength(20);
    expect(missing.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: InstrumentType.STOCK }),
      ]),
    );
    expect(
      missing.body.data.every(
        ({ type }: { type: string }) => type === InstrumentType.STOCK,
      ),
    ).toBe(true);
    expect(blank.body).toEqual(missing.body);
  });

  it('returns an empty page when no instruments match', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: `${marker}-missing` })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { limit: 20, offset: 0 },
    });
  });

  it.each(['limit=101', 'limit=1.5', 'limit=1&limit=2', 'search=%00'])(
    'rejects invalid query %s with Problem Details',
    async (query) => {
      const response = await request(app.getHttpServer())
        .get(`/instruments?${query}`)
        .expect(400)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        instance: '/instruments',
        code: 'INVALID_REQUEST',
        errors: expect.arrayContaining([expect.any(String)]),
      });
    },
  );

  it('returns a controlled 500 without exposing persistence details', async () => {
    vi.spyOn(
      app.get(InstrumentSearchRepository),
      'search',
    ).mockRejectedValueOnce(
      new Error('Private database connection and SQL information'),
    );

    const response = await request(app.getHttpServer())
      .get('/instruments')
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      instance: '/instruments',
      code: 'INTERNAL_ERROR',
    });
  });
});
