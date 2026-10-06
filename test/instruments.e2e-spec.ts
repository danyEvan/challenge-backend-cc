import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { Repository } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { setupApplication } from '../src/app.setup.js';
import { InstrumentEntity } from '../src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { InstrumentType } from '../src/shared/domain/trading/trading.types.js';
import { InstrumentSearchRepository } from '../src/instruments/application/ports/instrument-search.repository.js';

describe('Instrument search (HTTP and PostgreSQL)', () => {
  let app: INestApplication<App>;
  let repository: Repository<InstrumentEntity>;
  let fixtures: InstrumentEntity[] = [];
  const marker = `search-e2e-${randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApplication(app);
    await app.init();
    repository = app.get(DataSource).getRepository(InstrumentEntity);
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
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    try {
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
      data: [fixtures[4]],
      meta: { limit: 20, offset: 0 },
    });
  });

  it('matches tradable names and preserves nullable fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: marker.toUpperCase() })
      .expect(200);

    expect(response.body.data).toEqual([fixtures[0], fixtures[1], fixtures[3]]);
    expect(response.body.data.at(-1)).toMatchObject({
      ticker: null,
      type: InstrumentType.STOCK,
    });
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
      data: fixtures.slice(0, 2),
      meta: { limit: 2, offset: 0 },
    });
    expect(second.body).toEqual({
      data: [fixtures[3]],
      meta: { limit: 2, offset: 2 },
    });
  });

  it('treats % as literal search text', async () => {
    const response = await request(app.getHttpServer())
      .get('/instruments')
      .query({ search: `${marker} 100%` })
      .expect(200);

    expect(response.body.data).toEqual([fixtures[0]]);
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
