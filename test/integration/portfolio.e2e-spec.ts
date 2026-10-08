import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '#src/app.module.js';
import { setupApplication } from '#src/app.setup.js';

describe('Portfolio persistence (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useLogger(false);
    setupApplication(app);
    await app.init();
  });

  afterAll(async () => app.close());

  it('separates executed cash from reservations in the provided seed', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/1/portfolio')
      .expect(200);

    expect(response.body.data).toMatchObject({
      userId: 1,
      totalValue: '889756.00',
      cashBalance: '753000.00',
      reservedCash: '125500.00',
      availableCash: '627500.00',
    });
  });
});
