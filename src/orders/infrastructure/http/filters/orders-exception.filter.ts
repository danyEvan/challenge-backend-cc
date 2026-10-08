import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { ApiProblemException } from '#src/shared/infrastructure/http/api-problem.exception.js';
import { ProblemDetailsFilter } from '#src/shared/infrastructure/http/problem-details.filter.js';
import { IdempotencyConflictError } from '#src/shared/infrastructure/idempotency/idempotency-conflict.error.js';
import { InvalidOrderError } from '#src/orders/domain/errors/invalid-order.error.js';
import { InstrumentNotFoundError } from '#src/orders/domain/errors/instrument-not-found.error.js';
import { InstrumentNotTradableError } from '#src/orders/domain/errors/instrument-not-tradable.error.js';
import { MarketDataUnavailableError } from '#src/orders/domain/errors/market-data-unavailable.error.js';
import { UserNotFoundError } from '#src/orders/domain/errors/user-not-found.error.js';
import { RecordedOrderFailureError } from '#src/orders/infrastructure/persistence/recorded-order-failure.error.js';

@Catch(
  InvalidOrderError,
  InstrumentNotFoundError,
  InstrumentNotTradableError,
  MarketDataUnavailableError,
  UserNotFoundError,
  IdempotencyConflictError,
  RecordedOrderFailureError,
)
export class OrdersExceptionFilter extends ProblemDetailsFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof RecordedOrderFailureError) {
      host
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Idempotency-Outcome', 'finalized');
      super.catch(
        new ApiProblemException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          exception.code,
          exception.message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof IdempotencyConflictError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.CONFLICT,
          'IDEMPOTENCY_CONFLICT',
          exception.message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof InvalidOrderError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_ORDER',
          (exception as Error).message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof MarketDataUnavailableError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'MARKET_DATA_UNAVAILABLE',
          (exception as Error).message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof InstrumentNotFoundError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.NOT_FOUND,
          'NOT_FOUND',
          exception.message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof InstrumentNotTradableError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INSTRUMENT_NOT_TRADABLE',
          exception.message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof UserNotFoundError) {
      super.catch(
        new ApiProblemException(
          HttpStatus.NOT_FOUND,
          'NOT_FOUND',
          (exception as Error).message,
        ),
        host,
      );
      return;
    }

    super.catch(exception, host);
  }
}
