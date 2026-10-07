import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentEntity } from '#src/shared/infrastructure/persistence/entities/instrument.entity.js';
import { InstrumentSearchRepository } from '#src/instruments/application/ports/instrument-search.repository.js';
import { SearchInstruments } from '#src/instruments/application/usecases/search-instruments.js';
import { InstrumentSearchTypeOrmRepository } from '#src/instruments/infrastructure/persistence/instrument-search-typeorm.repository.js';
import { InstrumentsController } from '#src/instruments/infrastructure/http/controllers/instruments.controller.js';

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
