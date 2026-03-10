import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Welcome to Chat App - Verify your Email',
      template: './verification',
      context: {
        url,
      },
    });
  }
}
