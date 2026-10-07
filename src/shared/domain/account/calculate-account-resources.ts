import { Money } from '#src/shared/domain/money/money.js';
import type { AccountMovement } from './account-movement.js';
import {
  OrderSide,
  OrderStatus,
} from '#src/shared/domain/trading/trading.types.js';
import { InvalidAccountHistoryError } from '#src/shared/domain/account/errors/invalid-account-history.error.js';

export type AccountResources = Readonly<{
  availableCash: Money;
  positions: ReadonlyMap<number, number>;
}>;

export function calculateAccountResources(
  movements: readonly AccountMovement[],
): AccountResources {
  let availableCash = Money.zero();
  const positions = new Map<number, number>();

  for (const movement of movements) {
    // Las ordenes NEW no reservan
    if (movement.status !== OrderStatus.FILLED) {
      continue;
    }

    if (!Number.isSafeInteger(movement.size) || movement.size <= 0) {
      throw new InvalidAccountHistoryError(
        'Executed movement size must be a positive integer',
      );
    }

    switch (movement.side) {
      case OrderSide.CASH_IN:
        availableCash = availableCash.add(Money.from(String(movement.size)));
        break;
      case OrderSide.CASH_OUT:
        availableCash = availableCash.subtract(
          Money.from(String(movement.size)),
        );
        break;
      case OrderSide.BUY:
      case OrderSide.SELL: {
        if (movement.price === null) {
          throw new InvalidAccountHistoryError(
            'Executed trades require a historical price',
          );
        }
        if (movement.price.isNegative()) {
          throw new InvalidAccountHistoryError(
            'Executed trade price cannot be negative',
          );
        }
        const isBuy = movement.side === OrderSide.BUY;
        const tradeValue = movement.price.multiply(movement.size);
        availableCash = isBuy
          ? availableCash.subtract(tradeValue)
          : availableCash.add(tradeValue);

        const quantity =
          (positions.get(movement.instrumentId) ?? 0) +
          (isBuy ? movement.size : -movement.size);
        if (!Number.isSafeInteger(quantity)) {
          throw new InvalidAccountHistoryError(
            'Position quantity exceeds the safe integer range',
          );
        }

        if (quantity === 0) {
          positions.delete(movement.instrumentId);
        } else {
          // Conservamos tenencias negativas heredadas del historial
          positions.set(movement.instrumentId, quantity);
        }
        break;
      }
      default:
        throw new InvalidAccountHistoryError(
          'Unsupported executed movement side',
        );
    }
  }

  return { availableCash, positions };
}
