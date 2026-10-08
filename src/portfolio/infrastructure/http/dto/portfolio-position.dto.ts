import { ApiProperty } from '@nestjs/swagger';
import type { PortfolioPosition } from '#src/portfolio/application/interfaces/portfolio-position.js';

export class PortfolioPositionDto implements PortfolioPosition {
  @ApiProperty({ type: 'integer', example: 47 })
  instrumentId!: number;

  @ApiProperty({ type: String, nullable: true, example: 'PAMP' })
  ticker!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Pampa Holding' })
  name!: string | null;

  @ApiProperty({
    type: 'integer',
    example: 40,
    description: 'Signed quantity reconstructed from executed movements.',
  })
  quantity!: number;

  @ApiProperty({
    type: 'integer',
    example: 0,
    description: 'Quantity reserved by NEW SELL orders.',
  })
  reservedQuantity!: number;

  @ApiProperty({
    type: 'integer',
    example: 40,
    description: 'Executed quantity available after reservations.',
  })
  availableQuantity!: number;

  @ApiProperty({ example: '925.85' })
  marketPrice!: string;

  @ApiProperty({ example: '37034.00' })
  marketValue!: string;

  @ApiProperty({ type: String, nullable: true, example: '37200.00' })
  costBasis!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '-0.45',
    description:
      'Unrealized return on the remaining cost, not realized profit.',
  })
  returnPercentage!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0.44',
    description:
      'Price change from previousClose; not the account daily return.',
  })
  dailyPriceChangePercentage!: string | null;

  @ApiProperty({ type: String, format: 'date', example: '2023-07-14' })
  quoteDate!: string;
}
