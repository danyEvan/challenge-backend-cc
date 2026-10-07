import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SearchInstruments } from '#src/instruments/application/usecases/search-instruments.js';
import { ProblemDetailsDto } from '#src/shared/infrastructure/http/problem-details.dto.js';
import { SearchInstrumentsQueryDto } from '#src/instruments/infrastructure/http/dto/search-instruments-query.dto.js';
import { InstrumentSearchResponseDto } from '#src/instruments/infrastructure/http/dto/instrument-search-response.dto.js';

@ApiTags('Instruments')
@ApiExtraModels(ProblemDetailsDto)
@Controller('instruments')
export class InstrumentsController {
  constructor(
    @Inject(SearchInstruments)
    private readonly searchInstruments: SearchInstruments,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search tradable instruments by ticker or name',
    description:
      'Returns only tradable stock instruments. Currency represents account cash and is excluded. An absent or blank search lists the catalog ordered by ticker, then id; nullable tickers sort last. No matches returns an empty page.',
  })
  @ApiOkResponse({ type: InstrumentSearchResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid or unknown query parameters (application/problem+json)',
    content: {
      'application/problem+json': {
        schema: { $ref: getSchemaPath(ProblemDetailsDto) },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure (application/problem+json)',
    content: {
      'application/problem+json': {
        schema: { $ref: getSchemaPath(ProblemDetailsDto) },
      },
    },
  })
  async search(
    @Query() query: SearchInstrumentsQueryDto,
  ): Promise<InstrumentSearchResponseDto> {
    const { items, limit, offset } =
      await this.searchInstruments.execute(query);
    return { data: items, meta: { limit, offset } };
  }
}
