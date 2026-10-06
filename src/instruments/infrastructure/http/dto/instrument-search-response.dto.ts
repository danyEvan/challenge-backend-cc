import { ApiProperty } from '@nestjs/swagger';
import { InstrumentDto } from './instrument.dto.js';
import { InstrumentSearchMetaDto } from './instrument-search-meta.dto.js';

export class InstrumentSearchResponseDto {
  @ApiProperty({ type: [InstrumentDto] })
  data!: InstrumentDto[];

  @ApiProperty({ type: InstrumentSearchMetaDto })
  meta!: InstrumentSearchMetaDto;
}
