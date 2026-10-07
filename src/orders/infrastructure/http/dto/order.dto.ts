import { ApiProperty } from '@nestjs/swagger';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import type { OrderResult } from '#src/orders/application/interfaces/order-result.js';

export class OrderDto implements OrderResult {
  @ApiProperty({ description: 'Order ID', example: 1 })
  id!: number;

  @ApiProperty({ description: 'User ID', example: 1 })
  userId!: number;

  @ApiProperty({ description: 'Instrument ID', example: 47 })
  instrumentId!: number;

  @ApiProperty({
    description: 'Order side',
    enum: [OrderSide.BUY, OrderSide.SELL],
    example: OrderSide.BUY,
  })
  side!: OrderSide;

  @ApiProperty({
    description: 'Order type',
    enum: [OrderType.MARKET, OrderType.LIMIT],
    example: OrderType.MARKET,
  })
  type!: OrderType;

  @ApiProperty({ description: 'Number of shares', example: 10 })
  size!: number;

  @ApiProperty({
    description: 'Execution or limit price in ARS',
    example: '925.85',
  })
  price!: string;

  @ApiProperty({
    description: 'Order status',
    enum: [OrderStatus.FILLED, OrderStatus.NEW, OrderStatus.REJECTED],
    example: OrderStatus.FILLED,
  })
  status!: OrderStatus;

  @ApiProperty({
    description: 'Order creation timestamp in ISO 8601 format',
    example: '2023-07-14T15:30:00.000Z',
  })
  datetime!: string;
}
