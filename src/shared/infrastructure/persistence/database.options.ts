import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '#src/config/environment.js';
import { IdempotencyRecordEntity } from '#src/shared/infrastructure/persistence/entities/idempotency-record.entity.js';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { MarketDataEntity } from '#src/shared/infrastructure/persistence/entities/market-data.entity.js';
import { OrderEntity } from '#src/shared/infrastructure/persistence/entities/order.entity.js';
import { UserEntity } from '#src/shared/infrastructure/persistence/entities/user.entity.js';
import { CreateIdempotencyRecords1791374400000 } from '#src/shared/infrastructure/persistence/migrations/1791374400000-create-idempotency-records.js';

export function databaseOptions(environment: Environment): DataSourceOptions {
  return {
    type: 'postgres',
    url: environment.DATABASE_URL,
    entities: [
      UserEntity,
      InstrumentEntity,
      OrderEntity,
      MarketDataEntity,
      IdempotencyRecordEntity,
    ],
    migrations: [CreateIdempotencyRecords1791374400000],
    synchronize: false,
    migrationsRun: false,
    poolSize: 10,
    connectTimeoutMS: 5000,
    extra: { enableChannelBinding: true },
    // TypeORM puede registrar SQL y parámetros ante errores, se trata de evitarlo
    logging: ['warn'],
  };
}
