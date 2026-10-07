import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import type { ProblemDetailsDto } from './problem-details.dto.js';
import { ApiProblemException } from './api-problem.exception.js';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body: ProblemDetailsDto = {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Error',
      status,
      detail: 'An unexpected error occurred.',
      instance: request.path,
      code: 'INTERNAL_ERROR',
    };

    if (exception instanceof ApiProblemException) {
      body.code = exception.code;
      body.detail = exception.message;
      if (status >= 500) {
        this.logger.error(`HTTP request failed: ${exception.code}`);
      }
    } else if (exception instanceof HttpException && status < 500) {
      const payload = exception.getResponse();
      const message: unknown =
        typeof payload === 'string'
          ? payload
          : 'message' in payload
            ? payload.message
            : exception.message;

      body.code =
        status === 400
          ? 'INVALID_REQUEST'
          : status === 404
            ? 'NOT_FOUND'
            : 'HTTP_ERROR';
      if (
        Array.isArray(message) &&
        message.every((item) => typeof item === 'string')
      ) {
        body.errors = message;
        body.detail = message.join('; ');
      } else {
        body.detail = typeof message === 'string' ? message : body.title;
      }
    } else {
      // Un error de base algunas veces puede incluir credenciales o SQL.
      this.logger.error('An unexpected error interrupted an HTTP request.');
    }

    response.status(status).type('application/problem+json').json(body);
  }
}
