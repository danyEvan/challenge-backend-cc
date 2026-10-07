import type { OrderResult } from '#src/orders/application/interfaces/order-result.js';
import type { SubmitOrderInput } from '#src/orders/application/interfaces/submit-order-input.js';
import { OrderRepository } from '#src/orders/application/ports/order.repository.js';

export class SubmitOrder {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: SubmitOrderInput): Promise<OrderResult> {
    const order = await this.orderRepository.submitAtomically(input);

    return {
      ...order,
      price: order.price.toString(),
      datetime: order.datetime.toISOString(),
    };
  }
}
