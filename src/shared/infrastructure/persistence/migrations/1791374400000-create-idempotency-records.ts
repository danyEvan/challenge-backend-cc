import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdempotencyRecords1791374400000 implements MigrationInterface {
  name = 'CreateIdempotencyRecords1791374400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Conserva los nombres de columnas usados por el esquema original.
    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "id" SERIAL NOT NULL,
        "operation" varchar(100) NOT NULL,
        "scope" varchar(128) NOT NULL,
        "key" uuid NOT NULL,
        "requesthash" varchar(64) NOT NULL,
        "statuscode" integer,
        "result" jsonb,
        "createdat" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_idempotency_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_operation_scope_key" UNIQUE ("operation", "scope", "key"),
        CONSTRAINT "CHK_idempotency_result_status" CHECK (
          ("statuscode" IS NULL AND "result" IS NULL)
          OR ("statuscode" BETWEEN 100 AND 599 AND "result" IS NOT NULL)
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "idempotency_records"');
  }
}
