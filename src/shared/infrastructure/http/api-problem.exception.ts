import { HttpException } from '@nestjs/common';

export class ApiProblemException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail, status);
  }
}
