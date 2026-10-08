import type { Decimal } from 'decimal.js';
import { Money } from './money.js';

export function calculatePercentageChange(
  current: Money,
  base: Money | null,
): Decimal | null {
  if (base === null || base.compare(Money.zero()) <= 0) {
    return null;
  }

  return current.subtract(base).toDecimal().div(base.toDecimal()).times(100);
}

export function formatPercentage(value: Decimal | null): string | null {
  if (value === null) {
    return null;
  }

  const rounded = value.toDecimalPlaces(2);
  return rounded.isZero() ? '0.00' : rounded.toFixed(2);
}
