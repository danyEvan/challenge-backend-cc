import type { AccountMovement } from './account-movement.js';
import { calculateAccountResources } from './calculate-account-resources.js';
import { InvalidAccountHistoryError } from '#src/shared/domain/account/errors/invalid-account-history.error.js';
import { Money } from '#src/shared/domain/money/money.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';

export type AccountPositionAvailability = Readonly<{
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}>;

export type AccountAvailability = Readonly<{
  cashBalance: Money;
  reservedCash: Money;
  availableCash: Money;
  positions: ReadonlyMap<number, AccountPositionAvailability>;
}>;

export function calculateAccountAvailability(
  movements: readonly AccountMovement[],
): AccountAvailability {
  const resources = calculateAccountResources(movements);
  const reservations = calculateReservations(movements);
  const positions = new Map<number, AccountPositionAvailability>();

  for (const [instrumentId, quantity] of resources.positions) {
    const reservedQuantity = reservations.reservedShares.get(instrumentId) ?? 0;
    const unreservedQuantity = quantity - reservedQuantity;
    if (!Number.isSafeInteger(unreservedQuantity)) {
      throw new InvalidAccountHistoryError(
        'Available position quantity exceeds the safe integer range',
      );
    }

    positions.set(instrumentId, {
      quantity,
      reservedQuantity,
      availableQuantity: Math.max(unreservedQuantity, 0),
    });
  }

  return {
    cashBalance: resources.cashBalance,
    reservedCash: reservations.reservedCash,
    availableCash: resources.cashBalance.subtract(reservations.reservedCash),
    positions,
  };
}

function calculateReservations(movements: readonly AccountMovement[]): {
  reservedCash: Money;
  reservedShares: ReadonlyMap<number, number>;
} {
  let reservedCash = Money.zero();
  const reservedShares = new Map<number, number>();

  for (const movement of movements) {
    if (movement.status !== OrderStatus.NEW) {
      continue;
    }

    if (
      movement.type !== OrderType.LIMIT ||
      !Number.isSafeInteger(movement.size) ||
      movement.size <= 0 ||
      movement.price === null ||
      movement.price.compare(Money.zero()) <= 0
    ) {
      throw new InvalidAccountHistoryError(
        'Pending order has missing or invalid reservation fields',
      );
    }

    if (movement.side === OrderSide.BUY) {
      reservedCash = reservedCash.add(movement.price.multiply(movement.size));
      continue;
    }

    if (movement.side === OrderSide.SELL) {
      const quantity =
        (reservedShares.get(movement.instrumentId) ?? 0) + movement.size;
      if (!Number.isSafeInteger(quantity)) {
        throw new InvalidAccountHistoryError(
          'Reserved position quantity exceeds the safe integer range',
        );
      }
      reservedShares.set(movement.instrumentId, quantity);
      continue;
    }

    throw new InvalidAccountHistoryError(
      'Pending order side must be BUY or SELL',
    );
  }

  return { reservedCash, reservedShares };
}
