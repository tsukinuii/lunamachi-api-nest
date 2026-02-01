import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // เก็บ refresh token แบบ hash
  @Column({ type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  // ใช้ทำ rotation chain + reuse detection
  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // optional แต่แนะนำ (ช่วย debug/security)
  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;
}
