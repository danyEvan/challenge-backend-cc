import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRepository } from '#src/shared/application/ports/user.repository.js';
import { UserTypeOrmRepository } from '#src/shared/infrastructure/persistence/user-typeorm.repository.js';
import { PortfolioRepository } from '#src/portfolio/application/ports/portfolio.repository.js';
import { GetPortfolio } from '#src/portfolio/application/usecases/get-portfolio.js';
import { PortfolioController } from '#src/portfolio/infrastructure/http/controllers/portfolio.controller.js';
import { PortfolioTypeOrmRepository } from '#src/portfolio/infrastructure/persistence/portfolio-typeorm.repository.js';

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
