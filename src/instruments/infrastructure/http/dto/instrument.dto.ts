import { ApiProperty } from '@nestjs/swagger';
import { InstrumentType } from '#src/shared/domain/trading/trading.types.js';
import type { InstrumentSearchItem } from '#src/instruments/application/interfaces/instrument-search-item.js';

export class InstrumentDto implements InstrumentSearchItem {
  @ApiProperty({ type: 'integer', example: 34 })
  id!: number;

  @ApiProperty({ type: String, nullable: true, example: 'GGAL' })
  ticker!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Grupo Financiero Galicia',
  })
  name!: string | null;

  @ApiProperty({
    type: String,
    enum: [InstrumentType.STOCK],
    example: InstrumentType.STOCK,
  })
  type!: InstrumentType;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '885.80',
    description:
      'Close from the latest available marketdata row in ARS, not a live price.',
  })
  lastClose!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2023-07-14',
    description:
      'Date of the selected marketdata row (YYYY-MM-DD), if present.',
  })
  quoteDate!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '-3.48',
    description:
      '(close - previousClose) / previousClose × 100, not account return. Null if date, close or a positive previousClose is missing.',
  })
  dailyPriceChangePercentage!: string | null;
}
