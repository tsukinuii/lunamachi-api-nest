import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from '@/infrastructure/database/auth/user.orm-entity';
import { UserCredentialOrmEntity } from '@/infrastructure/database/auth/user-credential.orm-entity';
import { EmailOtpOrmEntity } from '@/infrastructure/database/auth/email-otp.orm-entity';
import { AuthService } from '@/application/auth/auth.service';
import { AuthController } from '@/interfaces/http/auth/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserCredentialOrmEntity,
      EmailOtpOrmEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
