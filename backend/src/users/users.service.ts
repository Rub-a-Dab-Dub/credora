// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PreferencesDto } from './dto/preferences.dto';
import { DeactivateProfileDto } from './dto/deactivate-profile.dto';
import { encrypt, decrypt } from './utils/encryption.util';
import { CacheService } from '../cache/cache.service'; // Import CacheService

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly cacheService: CacheService, // Inject CacheService
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
  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async getProfile(id: string) {
    const cacheKey = `user_profile:${id}`;
    const ttl = 3600; // Cache for 1 hour

    // The fallback function to get data from the database
    const fallback = async () => {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
        // Return null for the cache layer to handle, then check outside
        return null;
      }
      return user;
    };

    const user = await this.cacheService.getOrSet(cacheKey, fallback, ttl);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Decrypt PII after fetching from cache or DB
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

    const updatedUser = await this.usersRepository.save(user);

    // Invalidate the cache for this user
    await this.cacheService.invalidate(`user_profile:${id}`);

    return updatedUser;
  }

  async deleteProfile(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.usersRepository.delete(id);

    // Invalidate the cache
    await this.cacheService.invalidate(`user_profile:${id}`);

    return { deleted: true };
  }

  async setPreferences(id: string, dto: PreferencesDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.preferences = dto.preferences;
    const updatedUser = await this.usersRepository.save(user);

    // Invalidate the cache
    await this.cacheService.invalidate(`user_profile:${id}`);

    return updatedUser;
  }

  async exportProfile(id: string) {
    // This method is identical to getProfile, so we apply the same caching logic
    return this.getProfile(id);
  }

  async deactivateProfile(id: string, dto: DeactivateProfileDto) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = !dto.deactivate;
    const updatedUser = await this.usersRepository.save(user);

    // Invalidate the cache
    await this.cacheService.invalidate(`user_profile:${id}`);

    return updatedUser;
  }
}
