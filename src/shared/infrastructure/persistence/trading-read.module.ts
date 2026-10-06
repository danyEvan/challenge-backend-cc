import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TradingReader } from '../../application/ports/trading-reader.port.js';
import { MarketDataEntity } from './entities/market-data.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { TypeOrmTradingReader } from './typeorm-trading-reader.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, OrderEntity, MarketDataEntity]),
  ],
  providers: [
    {
      provide: TradingReader,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmTradingReader(dataSource.manager),
      inject: [DataSource],
    },
  ],
  exports: [TradingReader],
})
export class TradingReadModule {}
