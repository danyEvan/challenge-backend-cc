import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';
import { SubmitOrder } from '#src/orders/application/usecases/submit-order.js';
import { OrdersController } from '#src/orders/infrastructure/http/controllers/orders.controller.js';
import { OrderTypeOrmRepository } from '#src/orders/infrastructure/persistence/order-typeorm.repository.js';

@Module({
  controllers: [OrdersController],
  providers: [
    {
      provide: OrderRepository,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) =>
        new OrderTypeOrmRepository(dataSource),
    },
    {
      provide: SubmitOrder,
      inject: [OrderRepository],
      useFactory: (repository: OrderRepository) => new SubmitOrder(repository),
    },
  ],
})
export class OrdersModule {}
