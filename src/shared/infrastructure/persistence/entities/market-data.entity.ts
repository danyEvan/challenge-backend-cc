import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marketdata')
export class MarketDataEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instrumentid', type: 'int' })
  instrumentId!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  high!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  low!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  open!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  close!: string;

  @Column({ name: 'previousclose', type: 'numeric', precision: 10, scale: 2 })
  previousClose!: string;

  @Column({ type: 'date' })
  date!: string;
}
