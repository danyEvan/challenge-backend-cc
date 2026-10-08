import { ApiProperty } from '@nestjs/swagger';
import type { PortfolioResult } from '#src/portfolio/application/interfaces/portfolio-result.js';
import { PortfolioPositionDto } from './portfolio-position.dto.js';

export class PortfolioDto implements PortfolioResult {
  @ApiProperty({ type: 'integer', example: 1 })
  userId!: number;

  @ApiProperty({ enum: ['ARS'] })
  currency!: 'ARS';

  @ApiProperty({ example: '889756.00' })
  totalValue!: string;

  @ApiProperty({ example: '753000.00', description: 'Executed cash balance.' })
  cashBalance!: string;

  @ApiProperty({
    example: '125500.00',
    description: 'Cash reserved by NEW BUY orders.',
  })
  reservedCash!: string;

  @ApiProperty({
    example: '627500.00',
    description: 'Cash balance after reservations.',
  })
  availableCash!: string;

  @ApiProperty({ type: [PortfolioPositionDto] })
  positions!: PortfolioPositionDto[];
}
