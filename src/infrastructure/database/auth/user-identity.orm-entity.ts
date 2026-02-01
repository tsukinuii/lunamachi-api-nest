import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserRole } from './user.orm-entity';

export enum AuthProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  GITHUB = 'github',
}

@Entity('user_identities')
@Unique(['provider', 'providerUserId'])
export class UserIdentityOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  // id ของ user ฝั่ง provider (Google sub / Facebook id / GitHub id)
  @Column({ type: 'varchar', length: 255 })
  providerUserId: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // เก็บไว้ช่วย debug/แสดงผล (ไม่ต้อง unique)
  @Column({ type: 'varchar', length: 255, nullable: true })
  emailFromProvider: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}