import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentEntity } from '../shared/infrastructure/persistence/entities/instrument.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([InstrumentEntity])],
})
export class InstrumentsModule {}
