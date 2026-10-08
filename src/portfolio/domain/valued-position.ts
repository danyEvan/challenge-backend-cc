import type { Decimal } from 'decimal.js';
import type { Money } from '#src/shared/domain/money/money.js';

export type ValuedPosition = Readonly<{
  instrumentId: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  marketPrice: Money;
  marketValue: Money;
  costBasis: Money | null;
  returnPercentage: Decimal | null;
  dailyPriceChangePercentage: Decimal | null;
  quoteDate: string;
}>;
