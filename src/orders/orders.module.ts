import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IdempotencyKeyMiddleware } from '#src/shared/infrastructure/http/idempotency-key.middleware.js';
import { IdempotencyKeyContext } from '#src/shared/infrastructure/idempotency/idempotency-key.context.js';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';
import { SubmitOrder } from '#src/orders/application/usecases/submit-order.js';
import { OrdersController } from '#src/orders/infrastructure/http/controllers/orders.controller.js';
import { OrderTypeOrmRepository } from '#src/orders/infrastructure/persistence/order-typeorm.repository.js';

@Module({
  controllers: [OrdersController],
  providers: [
    IdempotencyKeyContext,
    IdempotencyKeyMiddleware,
    {
      provide: OrderRepository,
      inject: [DataSource, IdempotencyKeyContext],
      useFactory: (
        dataSource: DataSource,
        idempotencyKeyContext: IdempotencyKeyContext,
      ) => new OrderTypeOrmRepository(dataSource, idempotencyKeyContext),
    },
    {
      provide: SubmitOrder,
      inject: [OrderRepository],
      useFactory: (repository: OrderRepository) => new SubmitOrder(repository),
    },
  ],
})
export class OrdersModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdempotencyKeyMiddleware).forRoutes({
      path: 'orders',
      method: RequestMethod.POST,
    });
  }
}
