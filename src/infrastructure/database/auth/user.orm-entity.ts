import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum UserRole {
  USER = 'user',
  STAFF = 'staff',
  ADMIN = 'admin',
}

@Entity('users')
@Unique(['email'])
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  lastname: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
