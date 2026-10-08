import { Body, Controller, Inject, Post, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '#src/shared/infrastructure/http/problem-details.dto.js';
import { Money } from '#src/shared/domain/money/money.js';
import type { OrderRequest } from '#src/orders/application/interfaces/order-request.js';
import { SubmitOrder } from '#src/orders/application/usecases/submit-order.js';
import { CreateOrderDto } from '#src/orders/infrastructure/http/dto/create-order.dto.js';
import { OrderResponseDto } from '#src/orders/infrastructure/http/dto/order-response.dto.js';
import { OrdersExceptionFilter } from '#src/orders/infrastructure/http/filters/orders-exception.filter.js';

const problemContent = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};

function toOrderRequest(body: CreateOrderDto): OrderRequest {
  return {
    userId: body.userId,
    instrumentId: body.instrumentId,
    side: body.side,
    type: body.type,
    size: body.size,
    amount: body.amount === undefined ? undefined : Money.from(body.amount),
    price: body.price === undefined ? undefined : Money.from(body.price),
  };
}

@ApiTags('Orders')
@ApiExtraModels(ProblemDetailsDto)
@UseFilters(OrdersExceptionFilter)
@Controller('orders')
export class OrdersController {
  constructor(@Inject(SubmitOrder) private readonly submitOrder: SubmitOrder) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a new order',
    description:
      'Submit a BUY or SELL order. Specify exact size or total amount in ARS. For LIMIT orders, a positive price must be specified. For MARKET orders, the latest close price is used.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Required UUID v4. Reusing it for the same user and normalized request returns the original order.',
    schema: { type: 'string', format: 'uuid' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiCreatedResponse({
    description:
      'Order successfully processed and persisted (status FILLED, NEW, or REJECTED)',
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Missing or non-UUID-v4 Idempotency-Key, invalid input parameters, or exclusivity constraints violated',
    content: problemContent,
  })
  @ApiConflictResponse({
    description:
      'The idempotency key was already used by this user with a different order request',
    content: problemContent,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Order cannot be processed (e.g. calculated size is zero shares)',
    content: problemContent,
  })
  @ApiNotFoundResponse({
    description: 'User or instrument not found',
    content: problemContent,
  })
  @ApiInternalServerErrorResponse({
    description:
      'Missing market data returns 500 without creating an order or saving the key, so the same key can be retried. Idempotency-Outcome: finalized identifies a committed, replayable unexpected failure.',
    headers: {
      'Idempotency-Outcome': {
        description: 'finalized when the failure was committed for this key',
        schema: { type: 'string', enum: ['finalized'] },
      },
    },
    content: problemContent,
  })
  async submit(@Body() body: CreateOrderDto): Promise<OrderResponseDto> {
    const order = await this.submitOrder.execute(toOrderRequest(body));

    return { data: order };
  }
}
