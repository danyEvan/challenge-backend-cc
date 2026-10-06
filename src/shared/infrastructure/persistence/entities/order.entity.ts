import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../domain/trading/trading.types.js';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instrumentid', type: 'int' })
  instrumentId!: number;

  @Column({ name: 'userid', type: 'int' })
  userId!: number;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price!: string;

  @Column({ type: 'varchar', length: 10 })
  type!: OrderType;

  @Column({ type: 'varchar', length: 10 })
  side!: OrderSide;

  @Column({ type: 'varchar', length: 20 })
  status!: OrderStatus;

  @Column({ type: 'timestamp' })
  datetime!: Date;
}
