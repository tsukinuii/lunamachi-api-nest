import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { EmailOtpOrmEntity } from '@/infrastructure/database/auth/email-otp.orm-entity';
import {
  UserOrmEntity,
  UserStatus,
} from '@/infrastructure/database/auth/user.orm-entity';
import { UserCredentialOrmEntity } from '@/infrastructure/database/auth/user-credential.orm-entity';
import { RefreshTokenOrmEntity } from '@/infrastructure/database/auth/refresh-token.orm-entity';
import {
  AuthProvider,
  UserIdentityOrmEntity,
} from '@/infrastructure/database/auth/user-identity.orm-entity';
import { MailService } from '@/infrastructure/mail/mail.service';
import { ErrorCode } from '@/interfaces/http/common/error-codes';
import { firstValueFrom } from 'rxjs';

const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

const OTP_MAX_RESEND = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_TTL_MINUTES = 10; // OTP หมดอายุ 10 นาที

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly http: HttpService,

    @InjectRepository(EmailOtpOrmEntity)
    private readonly otpOrmRepo: Repository<EmailOtpOrmEntity>,

    @InjectRepository(UserOrmEntity)
    private readonly userOrmRepo: Repository<UserOrmEntity>,

    @InjectRepository(UserCredentialOrmEntity)
    private readonly credentialOrmRepo: Repository<UserCredentialOrmEntity>,

    @InjectRepository(RefreshTokenOrmEntity)
    private readonly refreshTokenOrmRepo: Repository<RefreshTokenOrmEntity>,

    @InjectRepository(UserIdentityOrmEntity)
    private readonly identityRepo: Repository<UserIdentityOrmEntity>,
  ) {}

  // === STEP 1: ขอ OTP ไปที่อีเมล ยืนยัน OTP แล้วสร้างผู้ใช้ ===
  async requestOtp(email: string) {
    // 1. check email already registered
    const existsUser = await this.userOrmRepo.findOneBy({ email });
    if (existsUser) {
      throw new BadRequestException({
        code: ErrorCode.EMAIL_ALREADY_REGISTERED,
        message: 'อีเมลนี้เคยสมัครแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน',
      });
    }

    const now = new Date();

    // 2. check OTP already exists
    const existingOtp = await this.otpOrmRepo.findOne({ where: { email } });

    // 3. ถ้ามี record เดิม
    if (existingOtp) {
      // 3.1 ถ้า resendCount เกิน OTP_MAX_RESEND throw error
      if (existingOtp.resendCount >= OTP_MAX_RESEND) {
        throw new BadRequestException({
          code: ErrorCode.OTP_RESEND_LIMIT,
          message: 'ขอ OTP เกินจำนวนที่กำหนด',
        });
      }

      // 3.2 ถ้ามี lastSentAt
      if (existingOtp.lastSentAt) {
        // คำนวณ nextAllowed = lastSentAt + 60s
        const nextAllowed = new Date(
          existingOtp.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
        );

        console.log('nextAllowed::', nextAllowed);
        console.log('now::', now);
        // ถ้า nextAllowed > now throw error
        if (nextAllowed > now) {
          throw new BadRequestException({
            code: ErrorCode.OTP_COOLDOWN,
            message: 'กรุณารอสักครู่แล้วลองใหม่',
          });
        }
      }
    }

    // 4. สร้าง OTP ใหม่
    const otp = randomInt(100000, 1000000).toString(); // 6 digits
    console.log('otp::', otp);
    const otpHash = await bcrypt.hash(otp, 10); // hash OTP
    console.log('otpHash::', otpHash);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000); // expires in 10 minutes

    this.logger.log('request-otp start');
    // 5. ถ้ามี record เดิม : update fields
    if (existingOtp) {
      existingOtp.otpHash = otpHash;
      existingOtp.expiresAt = expiresAt;
      existingOtp.attempts = 0;
      existingOtp.resendCount = existingOtp.resendCount + 1;
      existingOtp.lockedUntil = null;
      existingOtp.lastSentAt = now;

      // save OTP on DB
      await this.otpOrmRepo.save(existingOtp);
    } else {
      this.logger.log('before db save');
      // 6. ถ้าไม่มี record เดิม : create new record
      await this.otpOrmRepo.save({
        email,
        otpHash,
        expiresAt,
        attempts: 0,
        resendCount: 1,
        lockedUntil: null,
        lastSentAt: now,
      });
      this.logger.log('after db save');
    }

    // 6. send OTP to email
    this.logger.log('before send mail');
    console.log('before send email::', email);
    await this.mailService.sendOtpMail(email, otp);
    this.logger.log('after send mail');
    return { message: 'OTP ถูกส่งไปที่อีเมลแล้ว' };
  }

  // === STEP 2: ตรวจสอบ OTP ถ้าถูกต้องสร้าง User และ Credential และลบ OTP===
  async verifyOtpAndCreateUser(payload: {
    email: string;
    otp: string;
    password: string;
    username: string;
    name: string;
    lastname: string;
  }) {
    const { email, otp, password, username, name, lastname } = payload;

    // 1. ตรวจสอบ OTP
    const otpRecord = await this.otpOrmRepo.findOne({ where: { email } });
    console.log('otpRecord::', otpRecord);
    // 1.1 ถ้าไม่พบ OTP throw error
    if (!otpRecord) {
      throw new BadRequestException({
        code: ErrorCode.OTP_NOT_FOUND,
        message: 'ไม่พบ OTP',
      });
    }

    const now = new Date();

    // 2. ตรวจสอบ OTP ถูกล็อกชั่วคราว
    if (otpRecord.lockedUntil && otpRecord.lockedUntil > now) {
      throw new BadRequestException({
        code: ErrorCode.OTP_LOCKED,
        message: 'ถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง',
      });
    }

    // 3. ตรวจสอบ OTP หมดอายุ
    if (otpRecord.expiresAt < now)
      throw new BadRequestException({
        code: ErrorCode.OTP_EXPIRED,
        message: 'OTP หมดอายุ',
      });

    // 4. ตรวจสอบ OTP ถูกมั้ย
    const ok = await bcrypt.compare(otp, otpRecord.otpHash);
    console.log('ok::', ok);
    console.log('otp::', otp);
    console.log('otpRecord.otpHash::', otpRecord.otpHash);
    // 4.1 ถ้า OTP ไม่ถูกต้อง
    if (!ok) {
      const nextAttempts = otpRecord.attempts + 1;
      // ถ้าพยายามครบ OTP_MAX_ATTEMPTS แล้ว lock OTP
      const lockedUntil =
        nextAttempts >= OTP_MAX_ATTEMPTS
          ? new Date(now.getTime() + OTP_LOCK_MINUTES * 60 * 1000)
          : null;

      // update OTP record
      await this.otpOrmRepo.update(otpRecord.id, {
        attempts: nextAttempts,
        lockedUntil,
      });

      throw new BadRequestException({
        code: ErrorCode.OTP_INVALID,
        message: 'OTP ไม่ถูกต้อง',
      });
    }
    // 4.2 ถ้า OTP ถูกต้อง reset OTP record
    await this.otpOrmRepo.update(otpRecord.id, {
      attempts: 0,
      lockedUntil: null,
    });

    // 5. เช็ค email ซ้ำอีกครั้ง (ป้องกันสมัครแทรกซ้อน)
    const emailExists = await this.userOrmRepo.findOne({ where: { email } });
    if (emailExists) {
      throw new BadRequestException({
        code: ErrorCode.EMAIL_ALREADY_REGISTERED,
        message: 'อีเมลนี้เคยสมัครแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน',
      });
    }

    try {
      // 6. สร้าง User และ UserCredential
      return this.dataSource.transaction(async (manager) => {
        const user = manager.create(UserOrmEntity, {
          email,
          username,
          name,
          lastname,
        });
        await manager.save(user);

        // 7. สร้าง UserCredential
        const passwordHash = await bcrypt.hash(password, 10);
        const credential = manager.create(UserCredentialOrmEntity, {
          userId: user.id,
          passwordHash,
        });
        await manager.save(credential);

        // 8. ลบ OTP
        await manager.delete(EmailOtpOrmEntity, { email });

        return { message: 'สมัครสมาชิกสำเร็จ' };
      });
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new BadRequestException({
          code: ErrorCode.EMAIL_ALREADY_REGISTERED,
          message: 'ข้อมูลซ้ำ (อีเมลหรือ username ถูกใช้แล้ว)',
        });
      }
      throw e;
    }
  }

  // === Login ===
  async login(
    dto: { email: string; password: string },
    req: Request,
    res: Response,
  ) {
    const { email, password } = dto;

    const user = await this.userOrmRepo.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const cred = await this.credentialOrmRepo.findOne({
      where: { userId: user.id },
    });
    if (!cred) {
      throw new BadRequestException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'บัญชีนี้ไม่รองรับการเข้าสู่ระบบด้วยรหัสผ่าน',
      });
    }

    const ok = await bcrypt.compare(password, cred.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // ออก access + refresh cookie ผ่าน issueTokens “รอบเดียว”
    return await this.issueTokens({ id: user.id, role: user.role }, req, res);
  }

  // === Refresh Token ===
  async refresh(req: Request, res: Response) {
    const cookieName =
      this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';

    const refreshPlain = req.cookies?.[cookieName];
    if (!refreshPlain)
      throw new UnauthorizedException({
        code: ErrorCode.REFRESH_TOKEN_MISSING,
        message: 'Refresh token not found',
      });

    const repo = this.dataSource.getRepository(RefreshTokenOrmEntity);

    // หา candidate ที่ยังไม่หมดอายุ
    const candidates = await repo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });

    let matched: RefreshTokenOrmEntity | null = null;
    for (const c of candidates) {
      const ok = await bcrypt.compare(refreshPlain, c.tokenHash);
      if (ok) {
        matched = c;
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedException({
        code: ErrorCode.REFRESH_TOKEN_INVALID,
        message: 'Refresh token not found',
      });
    }

    // reuse detected: token นี้เคยถูก revoke ไปแล้ว แต่ยังถูกใช้ซ้ำ
    if (matched.revokedAt) {
      await this.revokeChainFrom(matched.id);
      throw new UnauthorizedException({
        code: ErrorCode.REFRESH_TOKEN_REUSED,
        message: 'Refresh token reuse detected',
      });
    }

    const now = new Date();

    if (matched.expiresAt < now) {
      await this.revokeChainFrom(matched.id);
      throw new UnauthorizedException({
        code: ErrorCode.REFRESH_TOKEN_EXPIRED,
        message: 'Refresh token expired',
      });
    }

    // Rotation: ออก refresh ใหม่ + เก็บใน DB
    const newRefreshPlain = randomBytes(48).toString('base64url');
    const newRefreshHash = await bcrypt.hash(newRefreshPlain, 10);

    const ttlDays = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') || '30',
    );
    const newExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const newRow = await repo.save({
      userId: matched.userId,
      tokenHash: newRefreshHash,
      expiresAt: newExpiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      userAgent: req.headers['user-agent'] ?? null,
      ip:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.ip ??
        null,
    });

    // revoke ตัวเก่า + เชื่อม chain
    await repo.update(matched.id, {
      revokedAt: now,
      replacedByTokenId: newRow.id,
    });

    // ออก access token ใหม่
    const user = await this.userOrmRepo.findOne({
      where: { id: matched.userId },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'User not found',
      });
    }

    const jti = randomUUID();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      jti,
      role: user.role,
    });

    // set cookie ใหม่
    res.cookie(cookieName, newRefreshPlain, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  }

  private async revokeChainFrom(tokenId: string) {
    const repo = this.dataSource.getRepository(RefreshTokenOrmEntity);
    const now = new Date();

    let currentId: string | null = tokenId;

    for (let i = 0; i < 50 && currentId; i++) {
      const row = await repo.findOne({ where: { id: currentId } });
      if (!row) break;

      if (!row.revokedAt) {
        await repo.update(row.id, { revokedAt: now });
      }

      currentId = row.replacedByTokenId;
    }
  }

  // === Logout ===
  async logout(req: Request, res: Response) {
    const cookieName =
      this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';

    const refreshPlain = req.cookies?.[cookieName];

    // ไม่เจอ cookie ก็ถือว่า logout สำเร็จ (idempotent)
    if (!refreshPlain) {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/auth/refresh',
      });
      return { message: 'ออกจากระบบแล้ว' };
    }

    const repo = this.dataSource.getRepository(RefreshTokenOrmEntity);

    // หา token ที่ match
    const candidates = await repo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });

    let matched: RefreshTokenOrmEntity | null = null;
    for (const c of candidates) {
      const ok = await bcrypt.compare(refreshPlain, c.tokenHash);
      if (ok) {
        matched = c;
        break;
      }
    }

    if (matched && !matched.revokedAt) {
      await repo.update(matched.id, { revokedAt: new Date() });
    }

    // clear cookie
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
    });

    return { message: 'ออกจากระบบแล้ว' };
  }

  private async fetchSocialProfile(
    provider: 'google' | 'facebook' | 'github',
    accessToken: string,
  ) {
    if (provider === 'google') {
      const { data } = await firstValueFrom(
        this.http.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return {
        providerUserId: String(data.sub),
        email: data.email ?? null,
        name: data.given_name ?? data.name ?? null,
        lastname: data.family_name ?? '-',
        avatarUrl: data.picture ?? null,
      };
    }

    if (provider === 'github') {
      const { data: u } = await firstValueFrom(
        this.http.get('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      // GitHub บางเคสต้องเรียกอีก endpoint เพื่อเอา email (และอาจไม่มี)
      let email: string | null = u.email ?? null;
      if (!email) {
        const { data: emails } = await firstValueFrom(
          this.http.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        );
        const primary = Array.isArray(emails)
          ? (emails.find((e: any) => e.primary && e.verified) ??
            emails.find((e: any) => e.verified))
          : null;
        email = primary?.email ?? null;
      }

      return {
        providerUserId: String(u.id),
        email,
        name: u.name ?? u.login ?? null,
        lastname: '-',
        avatarUrl: u.avatar_url ?? null,
        githubLogin: u.login ?? null,
      };
    }

    // facebook
    const { data } = await firstValueFrom(
      this.http.get('https://graph.facebook.com/me', {
        params: {
          fields: 'id,name,email,picture.type(large)',
          access_token: accessToken,
        },
      }),
    );

    return {
      providerUserId: String(data.id),
      email: data.email ?? null,
      name: data.name ?? null,
      lastname: '-',
      avatarUrl: data?.picture?.data?.url ?? null,
    };
  }

  private async issueTokens(
    user: { id: string; role: string },
    req: Request,
    res: Response,
  ) {
    const jti = randomUUID();
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      jti,
      role: user.role,
    });

    const refreshPlain = randomBytes(48).toString('base64url');
    const refreshHash = await bcrypt.hash(refreshPlain, 10);

    const ttlDays = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') || '30',
    );
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.dataSource.getRepository(RefreshTokenOrmEntity).save({
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      userAgent: req.headers['user-agent'] ?? null,
      ip:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
        req.ip ??
        null,
    });

    const cookieName =
      this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';
    res.cookie(cookieName, refreshPlain, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/auth/refresh',
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  }

  // === Social Exchange ===
  async socialExchange(
    dto: { provider: 'google' | 'facebook' | 'github'; accessToken: string },
    req: Request,
    res: Response,
  ) {
    const { provider, accessToken } = dto;

    const profile = await this.fetchSocialProfile(provider, accessToken);

    if (!profile.email) {
      throw new BadRequestException({
        code: 'SOCIAL_EMAIL_REQUIRED',
        message: 'บัญชี Social นี้ไม่ส่งอีเมล กรุณาเลือกบัญชีที่มีอีเมล',
      });
    }

    const providerEnum =
      provider === 'google'
        ? AuthProvider.GOOGLE
        : provider === 'facebook'
          ? AuthProvider.FACEBOOK
          : AuthProvider.GITHUB;

    // 1) ถ้า identity นี้เคยมีแล้ว = login ได้เลย
    const existingIdentity = await this.identityRepo.findOne({
      where: { provider: providerEnum, providerUserId: profile.providerUserId },
    });

    if (existingIdentity) {
      const user = await this.userOrmRepo.findOne({
        where: { id: existingIdentity.userId },
      });
      if (!user) {
        throw new UnauthorizedException({
          code: ErrorCode.USER_NOT_FOUND,
          message: 'User not found',
        });
      }

      return await this.issueTokens({ id: user.id, role: user.role }, req, res);
    }

    // 2) policy: ถ้า email เคยสมัครแล้ว (local หรือ social อื่น) -> throw error (ไม่ link)
    const emailOwner = await this.userOrmRepo.findOne({
      where: { email: profile.email },
    });
    if (emailOwner) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message:
          'อีเมลนี้เคยสมัครแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน หรือกด “ลืมรหัสผ่าน”',
      });
    }

    // 3) สร้าง user + identity (transaction)
    const baseUsername =
      ((profile as any).githubLogin ??
        profile.email
          .split('@')[0]
          .replace(/[^a-zA-Z0-9._-]/g, '')
          .slice(0, 30)) ||
      'user';

    const username =
      `${baseUsername}_${provider}_${profile.providerUserId}`.slice(0, 50);

    const userId = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(UserOrmEntity, {
        email: profile.email,
        username,
        name: profile.name ?? baseUsername,
        lastname: profile.lastname ?? '-',
        avatarUrl: profile.avatarUrl ?? null,
        status: UserStatus.ACTIVE,
      });
      await manager.save(user);

      const identity = manager.create(UserIdentityOrmEntity, {
        userId: user.id,
        provider: providerEnum,
        providerUserId: profile.providerUserId,
        emailFromProvider: profile.email,
      });
      await manager.save(identity);

      return user.id;
    });

    return await this.issueTokens({ id: userId, role: 'user' }, req, res);
  }
}
