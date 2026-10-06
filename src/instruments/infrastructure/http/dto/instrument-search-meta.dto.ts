import { ApiProperty } from '@nestjs/swagger';

export class InstrumentSearchMetaDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    example: 20,
    description: 'Maximum number of items requested, not the returned count.',
  })
  limit!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    example: 0,
    description: 'Number of matching items skipped before this page.',
  })
  offset!: number;
}
