import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('idempotency_records')
export class IdempotencyRecordEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  operation!: string;

  @Column({ type: 'varchar', length: 128 })
  scope!: string;

  @Column({ type: 'uuid' })
  key!: string;

  @Column({ name: 'requesthash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'jsonb', nullable: true })
  result!: unknown;

  @Column({ name: 'statuscode', type: 'integer', nullable: true })
  statusCode!: number | null;

  @Column({
    name: 'createdat',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
