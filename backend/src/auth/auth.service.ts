/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcrypt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from 'src/users/entities/refresh-token.entity';
import { User } from 'src/users/entities/user.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { WalletAuthDto } from './dto/wallet-auth.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private redisService: RedisService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await hash(password, saltRounds);

    // Generate email verification token
    const emailVerificationToken = uuidv4();

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      emailVerificationToken,
      isEmailVerified: false,
    });

    await this.userRepository.save(user);

    // Send verification email
    await this.emailService.sendEmailVerification(
      email,
      emailVerificationToken,
    );

    return {
      message: 'User registered. Please check your email for verification.',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && (await compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const { email, password, twoFactorCode } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !(await compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new UnauthorizedException(
          'Two-factor authentication code required',
        );
      }

      const isValid = authenticator.check(twoFactorCode, user.twoFactorSecret);
      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid two-factor authentication code',
        );
      }
    }

    return this.generateTokens(user);
  }

  async walletAuth(walletAuthDto: WalletAuthDto) {
    const { walletAddress, signature, message } = walletAuthDto;

    // Verify signature
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Find or create user
    let user = await this.userRepository.findOne({ where: { walletAddress } });
    if (!user) {
      user = this.userRepository.create({
        email: `${walletAddress}@wallet.local`,
        password: uuidv4(), // Random password
        walletAddress,
        isEmailVerified: true, // Wallet users are auto-verified
      });
      await this.userRepository.save(user);
    }

    return this.generateTokens(user);
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Store refresh token
    const refreshTokenEntity = this.refreshTokenRepository.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    // Store session in Redis
    const sessionKey = `session:${user.id}`;
    await this.redisService.set(
      sessionKey,
      JSON.stringify({ userId: user.id, email: user.email }),
      15 * 60,
    ); // 15 minutes

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    if (!tokenEntity || tokenEntity.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = tokenEntity.user;
    const tokens = await this.generateTokens(user);

    // Remove old refresh token
    await this.refreshTokenRepository.remove(tokenEntity);

    return tokens;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = '';
    await this.userRepository.save(user);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.save(user);

    await this.emailService.sendPasswordReset(email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const saltRounds = 12;
    user.password = await hash(newPassword, saltRounds);
    user.passwordResetToken = '';
    user.passwordResetExpires = new Date();
    await this.userRepository.save(user);

    return { message: 'Password reset successfully' };
  }

  async setupTwoFactor(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      this.configService.get('APP_NAME', 'MyApp'),
      secret,
    );

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not enabled yet)
    user.twoFactorSecret = secret;
    await this.userRepository.save(user);

    return {
      secret,
      qrCode,
    };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor setup not initiated');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      throw new BadRequestException('Invalid code');
    }

    user.twoFactorEnabled = true;
    await this.userRepository.save(user);

    return { message: 'Two-factor authentication enabled' };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication not enabled');
    }

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) {
      throw new BadRequestException('Invalid code');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = '';
    await this.userRepository.save(user);

    return { message: 'Two-factor authentication disabled' };
  }

  async logout(userId: string, refreshToken?: string) {
    // Remove session from Redis
    await this.redisService.del(`session:${userId}`);

    // Remove refresh token if provided
    if (refreshToken) {
      await this.refreshTokenRepository.delete({ token: refreshToken });
    }

    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'isEmailVerified',
        'twoFactorEnabled',
        'walletAddress',
        'createdAt',
      ],
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }
}
