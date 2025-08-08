// src/users/users.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PreferencesDto } from './dto/preferences.dto';
import { DeactivateProfileDto } from './dto/deactivate-profile.dto';
import { ExportProfileDto } from './dto/export-profile.dto';
import { encrypt, decrypt } from './utils/encryption.util';

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createProfile(dto: CreateProfileDto) {
    // Encrypt PII
    const encryptedFullName = encrypt(dto.fullName, ENCRYPTION_KEY);
    const encryptedEmail = encrypt(dto.email, ENCRYPTION_KEY);
    const user = this.usersRepository.create({
      encryptedFullName,
      encryptedEmail,
      walletAddress: dto.walletAddress,
      preferences: dto.preferences,
      profileCompleted: !!(dto.fullName && dto.email && dto.walletAddress),
      isActive: true,
    });
    return this.usersRepository.save(user);
  }

  async getProfile(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      fullName: decrypt(user.encryptedFullName, ENCRYPTION_KEY),
      email: decrypt(user.encryptedEmail, ENCRYPTION_KEY),
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      profileCompleted: user.profileCompleted,
      isActive: user.isActive,
    };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.fullName) user.encryptedFullName = encrypt(dto.fullName, ENCRYPTION_KEY);
    if (dto.email) user.encryptedEmail = encrypt(dto.email, ENCRYPTION_KEY);
    if (dto.walletAddress) user.walletAddress = dto.walletAddress;
    if (dto.preferences) user.preferences = dto.preferences;
    user.profileCompleted = !!(user.encryptedFullName && user.encryptedEmail && user.walletAddress);
    return this.usersRepository.save(user);
  }

  async deleteProfile(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepository.delete(id);
    return { deleted: true };
  }

  async setPreferences(id: string, dto: PreferencesDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.preferences = dto.preferences;
    return this.usersRepository.save(user);
  }

  async exportProfile(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      fullName: decrypt(user.encryptedFullName, ENCRYPTION_KEY),
      email: decrypt(user.encryptedEmail, ENCRYPTION_KEY),
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      profileCompleted: user.profileCompleted,
      isActive: user.isActive,
    };
  }

  async deactivateProfile(id: string, dto: DeactivateProfileDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = !dto.deactivate;
    return this.usersRepository.save(user);
  }
}
