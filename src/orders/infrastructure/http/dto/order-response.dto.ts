import { ApiProperty } from '@nestjs/swagger';
import { OrderDto } from './order.dto.js';

export class OrderResponseDto {
  @ApiProperty({ type: OrderDto })
  data!: OrderDto;
}
