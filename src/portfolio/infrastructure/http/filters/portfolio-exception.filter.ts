import { Catch } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { InvalidAccountHistoryError } from '../../../../shared/domain/account/errors/invalid-account-history.error.js';
import { ApiProblemException } from '../../../../shared/infrastructure/http/api-problem.exception.js';
import { ProblemDetailsFilter } from '../../../../shared/infrastructure/http/problem-details.filter.js';
import { PortfolioDataUnavailableError } from '../../../domain/errors/portfolio-data-unavailable.error.js';
import { UserNotFoundError } from '../../../domain/errors/user-not-found.error.js';

@Catch(
  UserNotFoundError,
  PortfolioDataUnavailableError,
  InvalidAccountHistoryError,
)
export class PortfolioExceptionFilter extends ProblemDetailsFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof UserNotFoundError) {
      super.catch(
        new ApiProblemException(404, 'NOT_FOUND', exception.message),
        host,
      );
      return;
    }

    if (exception instanceof PortfolioDataUnavailableError) {
      super.catch(
        new ApiProblemException(
          500,
          'PORTFOLIO_DATA_UNAVAILABLE',
          exception.message,
        ),
        host,
      );
      return;
    }

    if (exception instanceof InvalidAccountHistoryError) {
      super.catch(
        new ApiProblemException(
          500,
          'INVALID_ACCOUNT_HISTORY',
          'Portfolio cannot be reconstructed from the account history.',
        ),
        host,
      );
      return;
    }

    super.catch(exception, host);
  }
}
