import { describe, expect, it } from 'vitest';
import { Money } from '#src/shared/domain/money/money.js';

describe('Money', () => {
  it('adds decimals without binary floating point errors', () => {
    const result = Money.from('0.1').add(Money.from('0.2'));

    expect(result.toString()).toBe('0.30');
    expect(result.compare(Money.from('0.3'))).toBe(0);
  });

  it('keeps intermediate precision and serializes rounded decimal strings', () => {
    const halfCent = Money.from('0.005');

    expect(halfCent.toDecimal().toString()).toBe('0.005');
    expect(halfCent.toString()).toBe('0.01');
    expect(halfCent.add(halfCent).toString()).toBe('0.01');
    expect(JSON.stringify({ amount: halfCent })).toBe('{"amount":"0.01"}');
  });

  it('does not mutate the amount when calculating a trade value', () => {
    const price = Money.from('84.50');

    expect(price.multiply(123).toString()).toBe('10393.50');
    expect(price.toString()).toBe('84.50');
  });

  it.each(['NaN', 'invalid'])(
    'rejects invalid or non-finite amount %s',
    (value) => {
      expect(() => Money.from(value)).toThrow();
    },
  );
});
