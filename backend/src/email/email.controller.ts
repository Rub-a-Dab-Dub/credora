// src/email/email.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('verify')
  async sendVerification(@Body('email') email: string, @Body('token') token: string) {
    await this.emailService.sendEmailVerification(email, token);
    return { message: 'Verification email sent' };
  }

  @Post('reset')
  async sendPasswordReset(@Body('email') email: string, @Body('token') token: string) {
    await this.emailService.sendPasswordReset(email, token);
    return { message: 'Password reset email sent' };
  }
}
