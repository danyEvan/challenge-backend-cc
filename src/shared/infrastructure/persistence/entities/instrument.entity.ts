import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { InstrumentType } from '../../../domain/trading/trading.types.js';

@Entity('instruments')
export class InstrumentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10 })
  ticker!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 10 })
  type!: InstrumentType;
}
