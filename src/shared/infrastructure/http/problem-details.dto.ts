import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemDetailsDto {
  @ApiProperty({ type: String, example: 'about:blank' })
  type!: string;

  @ApiProperty({ type: String, example: 'Bad Request' })
  title!: string;

  @ApiProperty({ type: 'integer', example: 400 })
  status!: number;

  @ApiProperty({ type: String, example: 'limit must not be greater than 100' })
  detail!: string;

  @ApiProperty({ type: String, example: '/instruments' })
  instance!: string;

  @ApiProperty({ type: String, example: 'INVALID_REQUEST' })
  code!: string;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];
}
