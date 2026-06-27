import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) throw new UnauthorizedException('AUTH_TOKEN_REQUIRED');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = await this.refreshUserClaims(payload);
      return true;
    } catch {
      throw new UnauthorizedException('AUTH_TOKEN_INVALID');
    }
  }

  private async refreshUserClaims(payload: any) {
    if (!payload?.userId || !payload?.tenantId) return payload;

    const result = await this.db.query<{
      user_id: string;
      tenant_id: string;
      site_id: string | null;
      role_name: string | null;
      full_name: string;
      email: string | null;
      permissions: string[] | null;
    }>(
      `
      SELECT
        u.user_id,
        u.tenant_id,
        u.site_id,
        r.role_name,
        u.full_name,
        u.email,
        COALESCE(array_agg(DISTINCT p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      LEFT JOIN tenants t ON t.tenant_id = u.tenant_id
      WHERE u.user_id = $1
        AND u.tenant_id = $2
        AND u.is_active = true
        AND COALESCE(t.is_active, true) = true
        AND COALESCE(t.subscription_status, 'ACTIVE') <> 'SUSPENDED'
      GROUP BY u.user_id, u.tenant_id, u.site_id, r.role_name, u.full_name, u.email
      LIMIT 1
      `,
      [payload.userId, payload.tenantId],
    );

    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('AUTH_TOKEN_INVALID');

    return {
      ...payload,
      userId: user.user_id,
      tenantId: user.tenant_id,
      siteId: user.site_id ?? undefined,
      role: user.role_name ?? 'USER',
      fullName: user.full_name,
      email: user.email ?? undefined,
      permissions: user.permissions ?? [],
    };
  }
}
