import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline20260202233000 implements MigrationInterface {
  name = 'Baseline20260202233000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // baseline: intentionally empty
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // baseline: intentionally empty
  }
}