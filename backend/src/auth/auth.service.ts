import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/types/auth-user';
import { AuthRepository } from './auth.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
  private readonly maxLoginAttempts = 10;
  private readonly loginWindowMs = 15 * 60 * 1000;

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const loginKey = dto.email.trim().toLowerCase();
    this.assertLoginAllowed(loginKey);

    const user = await this.repository.findActiveUserByEmail(dto.email);

    if (!user) {
      this.recordFailedLogin(loginKey);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      this.recordFailedLogin(loginKey);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    this.loginAttempts.delete(loginKey);

    const profile: AuthUser = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      siteId: user.siteId,
      role: user.role,
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.signAsync(profile);

    return {
      accessToken,
      user: this.toProfile(profile),
    };
  }

  async me(user: AuthUser) {
    const freshUser = await this.repository.findActiveUserById(user.userId, user.tenantId);
    if (!freshUser) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return this.toProfile(freshUser);
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('PASSWORD_CONFIRMATION_MISMATCH');
    }

    const current = await this.repository.findActiveUserSecurityById(user.userId, user.tenantId);
    if (!current) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const oldPasswordOk = await bcrypt.compare(dto.oldPassword, current.passwordHash);
    if (!oldPasswordOk) throw new BadRequestException('INVALID_OLD_PASSWORD');

    const samePassword = await bcrypt.compare(dto.newPassword, current.passwordHash);
    if (samePassword) throw new BadRequestException('PASSWORD_REUSE_NOT_ALLOWED');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.repository.updatePasswordHash(user.userId, user.tenantId, passwordHash);

    return { changed: true };
  }

  private toProfile(user: AuthUser) {
    return {
      id: user.userId,
      tenantId: user.tenantId,
      siteId: user.siteId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
  }

  private assertLoginAllowed(loginKey: string) {
    const current = this.loginAttempts.get(loginKey);
    if (!current) return;

    const now = Date.now();
    if (now - current.firstAttemptAt > this.loginWindowMs) {
      this.loginAttempts.delete(loginKey);
      return;
    }

    if (current.count >= this.maxLoginAttempts) {
      throw new HttpException('LOGIN_RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailedLogin(loginKey: string) {
    const now = Date.now();
    const current = this.loginAttempts.get(loginKey);

    if (!current || now - current.firstAttemptAt > this.loginWindowMs) {
      this.loginAttempts.set(loginKey, { count: 1, firstAttemptAt: now });
      return;
    }

    this.loginAttempts.set(loginKey, {
      count: current.count + 1,
      firstAttemptAt: current.firstAttemptAt,
    });
  }
}
