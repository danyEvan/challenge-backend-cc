import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateIf,
  registerDecorator,
} from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';
import {
  OrderSide,
  OrderType,
} from '#src/shared/domain/trading/trading.types.js';
import {
  MAX_ORDER_MONEY,
  MAX_ORDER_SIZE,
} from '#src/orders/domain/order-limits.js';

const moneyPattern = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
const SubmittableOrderSide = {
  BUY: OrderSide.BUY,
  SELL: OrderSide.SELL,
} as const;

type SubmittableOrderSide =
  (typeof SubmittableOrderSide)[keyof typeof SubmittableOrderSide];

function isPositiveOrderMoney(value: unknown): value is string {
  if (typeof value !== 'string' || !moneyPattern.test(value)) {
    return false;
  }

  const [integer, fraction = ''] = value.split('.');
  return integer !== '0' || /[1-9]/.test(fraction);
}

export function IsPositiveOrderMoney(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPositiveOrderMoney',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isPositiveOrderMoney(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a positive decimal string with at most two decimal places and no greater than ${MAX_ORDER_MONEY}.`;
        },
      },
    });
  };
}

export function IsValidOrderQuantity(
  amountProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidOrderQuantity',
      target: object.constructor,
      propertyName,
      constraints: [amountProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [amountPropertyName] = args.constraints as [string];
          const dto = args.object as Record<string, unknown>;
          const hasSize = value !== undefined;
          const hasAmount = dto[amountPropertyName] !== undefined;

          if (hasSize === hasAmount) {
            return false;
          }

          return (
            !hasSize ||
            (Number.isInteger(value) &&
              (value as number) >= 1 &&
              (value as number) <= MAX_ORDER_SIZE)
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [amountPropertyName] = args.constraints as [string];
          const dto = args.object as Record<string, unknown>;
          const hasSize = args.value !== undefined;
          const hasAmount = dto[amountPropertyName] !== undefined;

          if (hasSize === hasAmount) {
            return `Exactly one of ${args.property} or ${amountPropertyName} must be specified.`;
          }

          return `${args.property} must be an integer between 1 and ${MAX_ORDER_SIZE}.`;
        },
      },
    });
  };
}

export function IsValidPriceForOrderType(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPriceForOrderType',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as { type?: OrderType };
          if (obj.type === OrderType.MARKET) {
            return value === undefined;
          }
          if (obj.type === OrderType.LIMIT) {
            return isPositiveOrderMoney(value);
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as { type?: OrderType };
          if (obj.type === OrderType.MARKET) {
            return 'MARKET orders cannot include a limit price.';
          }
          if (obj.type === OrderType.LIMIT) {
            return 'LIMIT orders require a positive price.';
          }
          return 'Invalid price for order type.';
        },
      },
    });
  };
}

export class CreateOrderDto {
  @ApiProperty({ description: 'User ID submitting the order', example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId!: number;

  @ApiProperty({ description: 'Target instrument ID', example: 47 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  instrumentId!: number;

  @ApiProperty({
    enum: Object.values(SubmittableOrderSide),
    description: 'Order side',
    example: OrderSide.BUY,
  })
  @IsEnum(SubmittableOrderSide)
  side!: SubmittableOrderSide;

  @ApiProperty({
    enum: [OrderType.MARKET, OrderType.LIMIT],
    description: 'Order type',
    example: OrderType.MARKET,
  })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiPropertyOptional({
    description: 'Exact number of shares (mutually exclusive with amount)',
    example: 10,
    type: 'integer',
    minimum: 1,
    maximum: MAX_ORDER_SIZE,
  })
  @IsValidOrderQuantity('amount')
  size?: number;

  @ApiPropertyOptional({
    description:
      'Positive ARS decimal string with at most two decimal places (mutually exclusive with size)',
    example: '50000.00',
    type: String,
    pattern: moneyPattern.source,
  })
  @ValidateIf((o) => o.amount !== undefined)
  @IsPositiveOrderMoney()
  amount?: string;

  @ApiPropertyOptional({
    description:
      'Positive ARS decimal string with at most two decimal places; required for LIMIT and disallowed for MARKET',
    example: '925.85',
    type: String,
    pattern: moneyPattern.source,
  })
  @IsValidPriceForOrderType()
  price?: string;
}
