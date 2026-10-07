import type { PersistedOrder } from '#src/orders/application/interfaces/persisted-order.js';
import type { SubmitOrderInput } from '#src/orders/application/interfaces/submit-order-input.js';

export abstract class OrderRepository {
  abstract submitAtomically(input: SubmitOrderInput): Promise<PersistedOrder>;
}
