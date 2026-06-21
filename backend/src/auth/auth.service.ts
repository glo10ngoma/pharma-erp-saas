import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/types/auth-user';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.repository.findActiveUserByEmail(dto.email);

    if (!user) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('INVALID_CREDENTIALS');

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

  me(user: AuthUser) {
    return this.toProfile(user);
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
}
