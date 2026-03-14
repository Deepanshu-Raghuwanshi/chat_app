import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/verify-email?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Welcome to Chat App - Verify your Email',
      template: './verification',
      context: {
        url,
      },
    });
  }

  async sendPasswordSetupEmail(email: string, token: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const url = `${frontendUrl}/set-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Set your Password - Chat App',
      template: './password-setup',
      context: {
        url,
      },
    });
  }
}
