import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentEntity } from '../shared/infrastructure/persistence/entities/instrument.entity.js';
import { TradingReadModule } from '../shared/infrastructure/persistence/trading-read.module.js';

@Module({
  imports: [TradingReadModule, TypeOrmModule.forFeature([InstrumentEntity])],
})
export class PortfolioModule {}
