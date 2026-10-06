import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnvironment } from '../../../config/environment.js';
import { databaseOptions } from './database.options.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          ...databaseOptions(
            validateEnvironment({
              NODE_ENV: configService.getOrThrow<string>('NODE_ENV'),
              PORT: configService.getOrThrow<number>('PORT'),
              DATABASE_URL: configService.getOrThrow<string>('DATABASE_URL'),
            }),
          ),
          retryAttempts: 3,
          retryDelay: 1000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
