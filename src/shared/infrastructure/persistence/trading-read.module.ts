import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TradingRepository } from '../../application/ports/trading.repository.js';
import { MarketDataEntity } from './entities/market-data.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { TradingTypeOrmRepository } from './trading-typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, MarketDataEntity])],
  providers: [
    {
      provide: TradingRepository,
      useFactory: (dataSource: DataSource) =>
        new TradingTypeOrmRepository(dataSource.manager),
      inject: [DataSource],
    },
  ],
  exports: [TradingRepository],
})
export class TradingReadModule {}
