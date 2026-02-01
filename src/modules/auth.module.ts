import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserOrmEntity } from '@/infrastructure/database/auth/user.orm-entity';
import { UserCredentialOrmEntity } from '@/infrastructure/database/auth/user-credential.orm-entity';
import { EmailOtpOrmEntity } from '@/infrastructure/database/auth/email-otp.orm-entity';
import { AuthService } from '@/application/auth/auth.service';
import { AuthController } from '@/interfaces/http/auth/auth.controller';
import { MailService } from '@/infrastructure/mail/mail.service';
import { RefreshTokenOrmEntity } from '@/infrastructure/database/auth/refresh-token.orm-entity';
import { UserIdentityOrmEntity } from '@/infrastructure/database/auth/user-identity.orm-entity';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '@/infrastructure/auth/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserCredentialOrmEntity,
      EmailOtpOrmEntity,
      RefreshTokenOrmEntity,
      UserIdentityOrmEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as StringValue,
          issuer: config.get<string>('JWT_ISSUER'),
          audience: config.get<string>('JWT_AUDIENCE'),
        },
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HttpModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
