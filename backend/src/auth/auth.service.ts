import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
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
      homeTenantId: user.tenantId,
      homeSiteId: user.siteId,
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
    const freshUser = await this.repository.findActiveUserHomeById(user.userId, user.homeTenantId ?? user.tenantId);
    if (!freshUser) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return this.toProfile({
      ...freshUser,
      homeTenantId: freshUser.tenantId,
      homeSiteId: freshUser.siteId,
      tenantId: user.tenantId,
      siteId: user.siteId,
    });
  }

  async organizations(user: AuthUser) {
    return this.repository.findAccessibleTenants(user);
  }

  async sites(user: AuthUser, tenantId?: string) {
    const activeTenantId = tenantId ?? user.tenantId;
    await this.assertTenantAllowed(user, activeTenantId);
    return this.repository.findAccessibleSites(user, activeTenantId);
  }

  async switchOrganization(user: AuthUser, tenantId: string) {
    await this.assertTenantAllowed(user, tenantId);
    const sites = await this.repository.findAccessibleSites(user, tenantId);
    const nextSiteId = sites.length === 1 ? sites[0].id : undefined;
    return this.issueContextToken(user, tenantId, nextSiteId, sites);
  }

  async switchSite(user: AuthUser, siteId: string) {
    const sites = await this.repository.findAccessibleSites(user, user.tenantId);
    if (!sites.some((site) => site.id === siteId)) {
      throw new ForbiddenException('SITE_NOT_ALLOWED');
    }
    return this.issueContextToken(user, user.tenantId, siteId, sites);
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
      homeTenantId: user.homeTenantId ?? user.tenantId,
      homeSiteId: user.homeSiteId ?? user.siteId,
      tenantId: user.tenantId,
      siteId: user.siteId,
      activeTenantId: user.tenantId,
      activeSiteId: user.siteId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
  }

  private async assertTenantAllowed(user: AuthUser, tenantId: string) {
    const tenants = await this.repository.findAccessibleTenants(user);
    if (!tenants.some((tenant) => tenant.id === tenantId)) {
      throw new ForbiddenException('TENANT_NOT_ALLOWED');
    }
  }

  private async issueContextToken(user: AuthUser, tenantId: string, siteId?: string, sites?: Array<{ id: string; code: string | null; name: string }>) {
    const profile: AuthUser = {
      // The authenticated request also carries JWT metadata (iat/exp).
      // Rebuild application claims so JwtService can issue a fresh expiration.
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
      tenantId,
      siteId,
      homeTenantId: user.homeTenantId ?? user.tenantId,
      homeSiteId: user.homeSiteId,
    };
    const accessToken = await this.jwtService.signAsync(profile);
    return {
      accessToken,
      user: this.toProfile(profile),
      sites: sites ?? await this.repository.findAccessibleSites(user, tenantId),
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
