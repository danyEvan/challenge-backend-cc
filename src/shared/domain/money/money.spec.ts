import { describe, expect, it } from 'vitest';
import { Money } from './money.js';

describe('Money', () => {
  it('adds decimals without binary floating point errors', () => {
    const result = Money.from('0.1').add(Money.from('0.2'));

    expect(result.toString()).toBe('0.30');
    expect(result.compare(Money.from('0.3'))).toBe(0);
  });

  it('preserves amounts beyond the precision of JavaScript numbers', () => {
    const result = Money.from('9007199254740993123456789.01').add(
      Money.from('0.02'),
    );

    expect(result.toString()).toBe('9007199254740993123456789.03');
  });

  it('keeps intermediate precision and rounds only on presentation', () => {
    const halfCent = Money.from('0.005');

    expect(halfCent.toDecimal().toString()).toBe('0.005');
    expect(halfCent.toString()).toBe('0.01');
    expect(halfCent.add(halfCent).toString()).toBe('0.01');
  });

  it('does not mutate the amount when calculating a trade value', () => {
    const price = Money.from('84.50');

    expect(price.multiply(123).toString()).toBe('10393.50');
    expect(price.toString()).toBe('84.50');
  });

  it('supports signed values inherited from account history', () => {
    const result = Money.from('10').subtract(Money.from('12.35'));

    expect(result.toString()).toBe('-2.35');
    expect(result.isNegative()).toBe(true);
    expect(Money.from('-0').isNegative()).toBe(false);
    expect(Money.from('-0.004').toString()).toBe('0.00');
  });

  it('serializes money as decimal strings', () => {
    expect(JSON.stringify({ amount: Money.from('10.5') })).toBe(
      '{"amount":"10.50"}',
    );
  });

  it.each(['NaN', 'Infinity', '-Infinity', 'invalid'])(
    'rejects invalid or non-finite amount %s',
    (value) => {
      expect(() => Money.from(value)).toThrow();
    },
  );

  it.each([1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects fractional or unsafe quantity %s',
    (quantity) => {
      expect(() => Money.from('10').multiply(quantity)).toThrow(RangeError);
    },
  );
});
