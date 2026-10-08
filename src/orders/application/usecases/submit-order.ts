import type { OrderResult } from '#src/orders/application/interfaces/order-result.js';
import type { OrderRequest } from '#src/orders/application/interfaces/order-request.js';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';

export class SubmitOrder {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: OrderRequest): Promise<OrderResult> {
    const order = await this.orderRepository.submitAtomically(input);

    return {
      ...order,
      price: order.price.toString(),
      datetime: order.datetime.toISOString(),
    };
  }
}
