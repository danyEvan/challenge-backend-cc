import { ApiProperty } from '@nestjs/swagger';
import { InstrumentType } from '../../../../shared/domain/trading/trading.types.js';
import type { InstrumentSearchItem } from '../../../application/interfaces/instrument-search-item.js';

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
}
