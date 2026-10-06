import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
  type!: string; // 'MARKET' | 'LIMIT'

  @Column({ type: 'varchar', length: 10 })
  side!: string; // 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'

  @Column({ type: 'varchar', length: 20 })
  status!: string; // 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED'

  @Column({ type: 'timestamp' })
  datetime!: Date;
}

