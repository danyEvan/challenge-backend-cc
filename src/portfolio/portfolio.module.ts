import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRepository } from '../shared/application/ports/user.repository.js';
import { UserTypeOrmRepository } from '../shared/infrastructure/persistence/user-typeorm.repository.js';
import { PortfolioRepository } from './application/ports/portfolio.repository.js';
import { GetPortfolio } from './application/usecases/get-portfolio.js';
import { PortfolioController } from './infrastructure/http/controllers/portfolio.controller.js';
import { PortfolioTypeOrmRepository } from './infrastructure/persistence/portfolio-typeorm.repository.js';

@Module({
  controllers: [PortfolioController],
  providers: [
    {
      provide: UserRepository,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new UserTypeOrmRepository(dataSource.manager),
    },
    {
      provide: PortfolioRepository,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new PortfolioTypeOrmRepository(dataSource),
    },
    {
      provide: GetPortfolio,
      inject: [PortfolioRepository, UserRepository],
      useFactory: (
        repository: PortfolioRepository,
        userRepository: UserRepository,
      ) => new GetPortfolio(repository, userRepository),
    },
  ],
})
export class PortfolioModule {}
