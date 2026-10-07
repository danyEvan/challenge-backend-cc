import { ApiProperty } from '@nestjs/swagger';
import { PortfolioDto } from './portfolio.dto.js';

export class PortfolioResponseDto {
  @ApiProperty({ type: PortfolioDto })
  data!: PortfolioDto;
}
