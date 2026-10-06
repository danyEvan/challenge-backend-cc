import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { Response } from 'express';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let database: { isInitialized: boolean; query: ReturnType<typeof vi.fn> };
  let response: Response;
  let setStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    database = {
      isInitialized: true,
      query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    setStatus = vi.fn();
    response = { status: setStatus } as unknown as Response;
    controller = new HealthController(database as unknown as DataSource);
  });

  it('returns 503 when the database query fails', async () => {
    database.query.mockRejectedValue(new Error('Database unavailable'));

    const result = await controller.check(response);

    expect(result.status).toBe('error');
    expect(result.details.database.status).toBe('down');
    expect(result.details.database).not.toHaveProperty('latencyMs');
    expect(setStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
