import type { PersistedOrder } from '#src/orders/application/interfaces/persisted-order.js';
import type { OrderRequest } from '#src/orders/application/interfaces/order-request.js';

export abstract class OrderRepository {
  abstract submitAtomically(input: OrderRequest): Promise<PersistedOrder>;
}
