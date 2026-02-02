import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
      requireTLS: true,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendOtpMail(to: string, otp: string) {
    try {
      await this.transporter.sendMail({
        from: 'LunaMachi <lunamachi@lunamachi.com>',
        to,
        subject: 'Your OTP',
        text: `Your OTP is ${otp} (expires in 10 minutes)`,
      });
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw error;
    }
  }
}
