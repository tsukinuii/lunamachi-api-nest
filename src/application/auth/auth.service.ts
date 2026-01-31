import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailOtpOrmEntity } from '@/infrastructure/database/auth/email-otp.orm-entity';
import { DataSource, Repository } from 'typeorm';
import { UserOrmEntity } from '@/infrastructure/database/auth/user.orm-entity';
import { UserCredentialOrmEntity } from '@/infrastructure/database/auth/user-credential.orm-entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(EmailOtpOrmEntity)
    private readonly otpOrmRepo: Repository<EmailOtpOrmEntity>,

    @InjectRepository(UserOrmEntity)
    private readonly userOrmRepo: Repository<UserOrmEntity>,

    @InjectRepository(UserCredentialOrmEntity)
    private readonly credentialOrmRepo: Repository<UserCredentialOrmEntity>,

  ) {}

  // === STEP 1: ขอ OTP ===
  async requestOtp(email: string) {
    // 1. check user already registered
    const existsUser = await this.userOrmRepo.findOneBy({ email });
    if (existsUser) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'อีเมลนี้เคยสมัครแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน',
      });
    }

    // 2. สร้าง OTP (ปลอดภัยกว่า Math.random)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

    // 3. หา OTP เดิม (1 email = 1 OTP)
    
    const existing = await this.otpOrmRepo.findOne({ where: { email } });
    if (existing) {
      existing.otpHash = otpHash;
      existing.expiresAt = expiresAt;
      existing.attempts = 0;
      existing.resendCount = existing.resendCount + 1;
      existing.lockedUntil = null;

      await this.otpOrmRepo.save(existing);

      console.log('OTP (dev only):', otp);
      return { message: 'OTP ถูกส่งไปที่อีเมลแล้ว' };
    }

    await this.otpOrmRepo.save({
      email,
      otpHash,
      expiresAt,
      attempts: 0,
      resendCount: 0,
    });

    console.log('OTP (dev only):', otp);

    return { message: 'OTP ถูกส่งไปที่อีเมลแล้ว' };
  }

  // === STEP 2: ตรวจสอบ OTP ===
  async verifyOtpAndCreateUser(payload: {
    email: string;
    otp: string;
    password: string;
    username: string;
    name: string;
    lastname: string;
  }) {
    const { email, otp, password, username, name, lastname } = payload;

    const otpRecord = await this.otpOrmRepo.findOne({ where: { email } });
    if (!otpRecord) throw new BadRequestException('ไม่พบ OTP');

    if (otpRecord.expiresAt < new Date())
      throw new BadRequestException('OTP หมดอายุ');

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) throw new BadRequestException('OTP ไม่ถูกต้อง');

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(UserOrmEntity, {
        email,
        username,
        name,
        lastname,
      });
      await manager.save(user);

      const passwordHash = await bcrypt.hash(password, 10);
      const credential = manager.create(UserCredentialOrmEntity, {
        userId: user.id,
        passwordHash,
      });
      await manager.save(credential);

      await manager.delete(EmailOtpOrmEntity, { email });

      return { message: 'สมัครสมาชิกสำเร็จ' };
    });
  }
}
