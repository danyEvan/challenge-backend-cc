import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  NotContains,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { InstrumentSearchCriteria } from '#src/instruments/application/interfaces/instrument-search-criteria.js';
import { parseQueryInteger } from '#src/instruments/infrastructure/http/transforms/parse-query-integer.js';

export class SearchInstrumentsQueryDto implements InstrumentSearchCriteria {
  @ApiPropertyOptional({
    type: String,
    maxLength: 255,
    pattern: '^[^\\u0000]*$',
    default: '',
    description:
      'Case-insensitive substring of ticker or name. Trimmed; empty lists the tradable stock catalog. SQL wildcards are literal. Null characters are invalid.',
    example: 'gal',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  @NotContains('\u0000', { message: 'search must not contain null characters' })
  search = '';

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Transform(({ value }: { value: unknown }) => parseQueryInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
    default: 0,
  })
  @Transform(({ value }: { value: unknown }) => parseQueryInteger(value))
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offset = 0;
}
