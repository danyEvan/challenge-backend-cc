import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentEntity } from '../shared/infrastructure/persistence/entities/instrument.entity.js';
import { InstrumentSearchRepository } from './application/ports/instrument-search.repository.js';
import { SearchInstruments } from './application/usecases/search-instruments.js';
import { InstrumentSearchTypeOrmRepository } from './infrastructure/persistence/instrument-search-typeorm.repository.js';
import { InstrumentsController } from './infrastructure/http/controllers/instruments.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([InstrumentEntity])],
  controllers: [InstrumentsController],
  providers: [
    {
      provide: InstrumentSearchRepository,
      useClass: InstrumentSearchTypeOrmRepository,
    },
    {
      provide: SearchInstruments,
      useFactory: (repository: InstrumentSearchRepository) =>
        new SearchInstruments(repository),
      inject: [InstrumentSearchRepository],
    },
  ],
})
export class InstrumentsModule {}
