import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('email_otps')
@Unique(['email']) // 1 email มี OTP active ได้แค่อันเดียว (อันล่าสุด)
export class EmailOtpOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  // เก็บ OTP แบบ hash (ห้ามเก็บ plaintext)
  @Column({ type: 'varchar', length: 255 })
  otpHash: string;

  // หมดอายุเมื่อไหร่ (เช่น now + 10 นาที)
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  // เดาผิดกี่ครั้งแล้ว
  @Column({ type: 'int', default: 0 })
  attempts: number;

  // กด resend กี่ครั้งแล้ว
  @Column({ type: 'int', default: 0 })
  resendCount: number;

  // ส่ง OTP ครั้งสุดท้ายเมื่อไหร่
  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  // ถ้าเดารัว ๆ ให้ล็อกชั่วคราวจนถึงเวลานี้
  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
