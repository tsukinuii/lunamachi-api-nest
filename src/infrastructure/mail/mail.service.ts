import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly mailFrom: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    this.mailFrom = this.configService.getOrThrow<string>('MAIL_FROM');

    this.resend = new Resend(apiKey);
  }
  // constructor(private readonly configService: ConfigService) {
  //   this.transporter = nodemailer.createTransport({
  //     host: this.configService.get<string>('MAIL_HOST'),
  //     port: this.configService.get<number>('MAIL_PORT'),
  //     secure: false,
  //     requireTLS: true,
  //     auth: {
  //       user: this.configService.get<string>('MAIL_USER'),
  //       pass: this.configService.get<string>('MAIL_PASS'),
  //     },
  //     connectionTimeout: 10_000,
  //     greetingTimeout: 10_000,
  //     socketTimeout: 10_000,
  //   });
  // }

  // async sendOtpMail(to: string, otp: string) {
  //   try {
  //     await this.transporter.sendMail({
  //       from: 'LunaMachi <lunamachi@lunamachi.com>',
  //       to,
  //       subject: 'Your OTP',
  //       text: `Your OTP is ${otp} (expires in 10 minutes)`,
  //     });
  //   } catch (error) {
  //     console.error('Failed to send OTP email:', error);
  //     throw error;
  //   }
  // }
  async sendOtpMail(to: string, otp: string) {
    try {
      this.logger.log(`Sending OTP to ${to}`);
      console.log('before sendOtpMail::', to);
      console.log('before sendOtpMail::', otp);
      console.log('before sendOtpMail::', this.mailFrom);
      const result = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: 'Your OTP code',
        html: `
          <h2>Your OTP</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
        `,
      });
      this.logger.log(`Resend response: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new InternalServerErrorException({
        code: 'EMAIL_SEND_FAILED',
        message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่',
      });
    }
  }
}
