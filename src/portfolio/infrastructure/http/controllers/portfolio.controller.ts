import {
  BadRequestException,
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
import { ProblemDetailsDto } from '../../../../shared/infrastructure/http/problem-details.dto.js';
import { GetPortfolio } from '../../../application/usecases/get-portfolio.js';
import { PortfolioParamsDto } from '../dto/portfolio-params.dto.js';
import { PortfolioResponseDto } from '../dto/portfolio-response.dto.js';
import { PortfolioExceptionFilter } from '../filters/portfolio-exception.filter.js';

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
    summary: 'Get account cash, positions and valuation',
    description:
      'Complete ARS portfolio, without pagination. Preserves signed historical balances. Latest available quotes may be historical.',
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
    @Query() query: Record<string, unknown>,
  ): Promise<PortfolioResponseDto> {
    if (Object.keys(query).length !== 0) {
      throw new BadRequestException('Query parameters are not supported.');
    }

    const data = await this.getPortfolio.execute(params.userId);

    for (const position of data.positions) {
      if (position.quantity < 0) {
        this.logger.warn(
          `User ${params.userId} has negative position on instrument ${position.instrumentId}: ${position.quantity} shares`,
        );
      }
    }

    return { data };
  }
}
