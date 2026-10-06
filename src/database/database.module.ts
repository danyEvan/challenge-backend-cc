import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL');
        const isSsl = url?.includes('sslmode=require') || url?.includes('neon.tech');

        return {
          type: 'postgres',
          url,
          autoLoadEntities: true,
          synchronize: false,
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          logging: configService.get<string>('NODE_ENV') === 'development',
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

