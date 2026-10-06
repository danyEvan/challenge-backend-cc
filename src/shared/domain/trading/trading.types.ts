export const OrderStatus = {
  NEW: 'NEW',
  FILLED: 'FILLED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const;

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
  CASH_IN: 'CASH_IN',
  CASH_OUT: 'CASH_OUT',
} as const;

export const InstrumentType = {
  STOCK: 'ACCIONES',
  CURRENCY: 'MONEDA',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export type OrderType = (typeof OrderType)[keyof typeof OrderType];
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];
export type InstrumentType =
  (typeof InstrumentType)[keyof typeof InstrumentType];
