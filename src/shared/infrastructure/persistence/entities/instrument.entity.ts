import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { InstrumentType } from '#src/shared/domain/trading/trading.types.js';

@Entity('instruments')
export class InstrumentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ticker!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  type!: InstrumentType | null;
}
