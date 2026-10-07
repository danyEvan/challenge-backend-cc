import { Body, Controller, Inject, Post, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '#src/shared/infrastructure/http/problem-details.dto.js';
import { Money } from '#src/shared/domain/money/money.js';
import type { SubmitOrderInput } from '#src/orders/application/interfaces/submit-order-input.js';
import { SubmitOrder } from '#src/orders/application/usecases/submit-order.js';
import { CreateOrderDto } from '#src/orders/infrastructure/http/dto/create-order.dto.js';
import { OrderResponseDto } from '#src/orders/infrastructure/http/dto/order-response.dto.js';
import { OrdersExceptionFilter } from '#src/orders/infrastructure/http/filters/orders-exception.filter.js';

const problemContent = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};

function toSubmitOrderInput(body: CreateOrderDto): SubmitOrderInput {
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
  @ApiCreatedResponse({
    description:
      'Order successfully processed and persisted (status FILLED, NEW, or REJECTED)',
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input parameters or exclusivity constraints violated',
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
    description: 'Market data unavailable or unexpected failure',
    content: problemContent,
  })
  async submit(@Body() body: CreateOrderDto): Promise<OrderResponseDto> {
    const order = await this.submitOrder.execute(toSubmitOrderInput(body));

    return { data: order };
  }
}
