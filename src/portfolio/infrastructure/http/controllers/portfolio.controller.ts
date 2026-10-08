import {
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '#src/shared/infrastructure/http/problem-details.dto.js';
import { GetPortfolio } from '#src/portfolio/application/usecases/get-portfolio.js';
import { PortfolioParamsDto } from '#src/portfolio/infrastructure/http/dto/portfolio-params.dto.js';
import { PortfolioQueryDto } from '#src/portfolio/infrastructure/http/dto/portfolio-query.dto.js';
import { PortfolioResponseDto } from '#src/portfolio/infrastructure/http/dto/portfolio-response.dto.js';
import { PortfolioExceptionFilter } from '#src/portfolio/infrastructure/http/filters/portfolio-exception.filter.js';

const problemContent = {
  'application/problem+json': {
    schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  },
};

@ApiTags('Portfolio')
@ApiExtraModels(ProblemDetailsDto)
@UseFilters(PortfolioExceptionFilter)
@Controller('users/:userId/portfolio')
export class PortfolioController {
  private readonly logger = new Logger(PortfolioController.name);

  constructor(
    @Inject(GetPortfolio) private readonly getPortfolio: GetPortfolio,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get account cash, reservations, positions and valuation',
    description:
      'Complete ARS portfolio, without pagination. NEW orders reserve cash or shares without changing executed positions or total value. Latest available quotes may be historical.',
  })
  @ApiParam({
    name: 'userId',
    schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
  })
  @ApiOkResponse({ type: PortfolioResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid userId or unexpected query parameters',
    content: problemContent,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    content: problemContent,
  })
  @ApiInternalServerErrorResponse({
    description: 'Invalid history, unavailable valuation or unexpected failure',
    content: problemContent,
  })
  async get(
    @Param() params: PortfolioParamsDto,
    @Query() _query: PortfolioQueryDto,
  ): Promise<PortfolioResponseDto> {
    const data = await this.getPortfolio.execute(params.userId);

    for (const position of data.positions) {
      if (position.quantity < 0) {
        // Se agrega tag para observabilidad y alertas.
        // (suponiendo que no es un producto que lo permita, ej: Short Selling)
        this.logger.warn(
          `[portfolio.negative_position] User ${params.userId} has negative position on instrument ${position.instrumentId}: ${position.quantity} shares`,
        );
      }
    }

    return { data };
  }
}
