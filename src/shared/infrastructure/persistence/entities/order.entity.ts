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

  @Column({ name: 'instrumentid', type: 'int', nullable: true })
  instrumentId!: number | null;

  @Column({ name: 'userid', type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'int', nullable: true })
  size!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  type!: OrderType | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  side!: OrderSide | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status!: OrderStatus | null;

  @Column({ type: 'timestamp', nullable: true })
  datetime!: Date | null;
}
