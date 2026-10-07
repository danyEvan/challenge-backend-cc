import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '#src/config/environment.js';
import { DatabaseModule } from '#src/shared/infrastructure/persistence/database.module.js';
import { HealthModule } from '#src/health/health.module.js';
import { InstrumentsModule } from '#src/instruments/instruments.module.js';
import { OrdersModule } from '#src/orders/orders.module.js';
import { PortfolioModule } from '#src/portfolio/portfolio.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    InstrumentsModule,
    OrdersModule,
    PortfolioModule,
  ],
})
export class AppModule {}
