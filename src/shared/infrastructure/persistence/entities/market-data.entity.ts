import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('marketdata')
export class MarketDataEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instrumentid', type: 'int', nullable: true })
  instrumentId!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  high!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  low!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  open!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  close!: string | null;

  @Column({
    name: 'previousclose',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  previousClose!: string | null;

  @Column({ type: 'date', nullable: true })
  date!: string | null;
}
