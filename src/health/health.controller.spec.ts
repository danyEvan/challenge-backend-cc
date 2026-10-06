import { describe, it, expect, beforeEach } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('should return health status ok with timestamp and uptime', async () => {
    const mockRes = { status: () => mockRes } as any;
    const result = await controller.check(mockRes);
    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('uptime');
    expect(typeof result.uptime).toBe('number');
    expect(result.details.database.status).toBe('up');
  });
});
