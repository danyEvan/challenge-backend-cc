import { describe, expect, it } from 'vitest';
import { Money } from '#src/shared/domain/money/money.js';
import {
  calculatePercentageChange,
  formatPercentage,
} from '#src/shared/domain/money/percentage-change.js';

describe('percentage change shared by catalog and portfolio', () => {
  it('rounds a price change halfway between hundredths away from zero', () => {
    const change = calculatePercentageChange(
      Money.from('10.01'),
      Money.from('8.00'),
    );

    expect(formatPercentage(change)).toBe('25.13');
  });

  it('does not calculate a percentage without a positive previous close', () => {
    for (const previousClose of [null, Money.zero(), Money.from('-1.00')]) {
      const change = calculatePercentageChange(
        Money.from('10.00'),
        previousClose,
      );
      expect(formatPercentage(change)).toBeNull();
    }
  });
});
