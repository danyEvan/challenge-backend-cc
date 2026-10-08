import { BadRequestException, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { NextFunction, Request, Response } from 'express';
import { IdempotencyKeyContext } from '#src/shared/infrastructure/idempotency/idempotency-key.context.js';

@Injectable()
export class IdempotencyKeyMiddleware implements NestMiddleware {
  constructor(private readonly context: IdempotencyKeyContext) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !isUUID(key, '4')) {
      throw new BadRequestException(
        'Idempotency-Key is required and must be a valid UUID v4.',
      );
    }

    this.context.run(key, next);
  }
}
