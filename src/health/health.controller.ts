import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Response } from 'express';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Application and database readiness check' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy and running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-10-05T20:55:00.000Z' },
        uptime: { type: 'number', example: 12.34 },
        details: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                latencyMs: { type: 'number', example: 5 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database is unavailable or not initialized',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    let dbStatus = 'down';
    let dbLatency: number | null = null;

    if (this.dataSource.isInitialized) {
      try {
        const start = performance.now();
        await this.dataSource.query('SELECT 1');
        dbLatency = Math.round(performance.now() - start);
        dbStatus = 'up';
      } catch {
        dbStatus = 'down';
      }
    }

    const isHealthy = dbStatus === 'up';
    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: {
        database: {
          status: dbStatus,
          ...(dbLatency !== null ? { latencyMs: dbLatency } : {}),
        },
      },
    };
  }
}
