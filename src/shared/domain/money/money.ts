import { Decimal } from 'decimal.js';

const Arithmetic = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export class Money {
  private constructor(private readonly value: Decimal) {}

  static from(value: string | Decimal): Money {
    const amount = new Arithmetic(value);
    if (!amount.isFinite()) {
      throw new RangeError('Money must be finite');
    }
    return new Money(amount);
  }

  static zero(): Money {
    return Money.from('0');
  }

  add(other: Money): Money {
    return Money.from(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return Money.from(this.value.minus(other.value));
  }

  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity)) {
      throw new RangeError('Quantity must be a safe integer');
    }
    return Money.from(this.value.times(quantity));
  }

  compare(other: Money): number {
    return this.value.comparedTo(other.value);
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  toDecimal(): Decimal {
    return new Arithmetic(this.value);
  }

  // Keep intermediate precision; round to ARS cents only for presentation.
  toString(): string {
    const rounded = this.value.toDecimalPlaces(2);
    return rounded.isZero() ? '0.00' : rounded.toFixed(2);
  }

  toJSON(): string {
    return this.toString();
  }
}
