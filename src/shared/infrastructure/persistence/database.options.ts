import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '../../../config/environment.js';
import { InstrumentEntity } from './entities/instrument.entity.js';
import { MarketDataEntity } from './entities/market-data.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { UserEntity } from './entities/user.entity.js';

export function databaseOptions(environment: Environment): DataSourceOptions {
  return {
    type: 'postgres',
    url: environment.DATABASE_URL,
    entities: [UserEntity, InstrumentEntity, OrderEntity, MarketDataEntity],
    migrations: [fileURLToPath(new URL('./migrations/*.js', import.meta.url))],
    synchronize: false,
    migrationsRun: false,
    poolSize: 10,
    connectTimeoutMS: 5000,
    extra: { enableChannelBinding: true },
    // TypeORM puede registrar SQL y parámetros ante errores, se trata de evitarlo
    logging: ['warn'],
  };
}
