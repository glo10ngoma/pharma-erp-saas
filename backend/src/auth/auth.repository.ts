import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type UserWithSecurity = {
  userId: string;
  tenantId: string;
  siteId?: string;
  role: string;
  fullName: string;
  email?: string;
  username: string;
  passwordHash: string;
  permissions: string[];
};

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly db: DatabaseService) {}

  async findActiveUserByEmail(email: string): Promise<UserWithSecurity | null> {
    let result;

    try {
      result = await this.db.query<{
      user_id: string;
      tenant_id: string;
      site_id: string | null;
      role_name: string | null;
      full_name: string;
      email: string | null;
      username: string;
      password_hash: string;
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
        u.username,
        u.password_hash,
        COALESCE(array_agg(DISTINCT p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') AS permissions
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      LEFT JOIN tenants t ON t.tenant_id = u.tenant_id
      WHERE lower(u.email) = lower($1)
        AND u.is_active = true
        AND u.tenant_id IS NOT NULL
        AND COALESCE(t.is_active, true) = true
        AND COALESCE(t.subscription_status, 'ACTIVE') <> 'SUSPENDED'
      GROUP BY u.user_id, u.tenant_id, u.site_id, r.role_name, u.full_name, u.email, u.username, u.password_hash
      LIMIT 1
      `,
      [email],
      );
    } catch (error) {
      this.logger.error('AUTH_LOGIN_QUERY_FAILED', error);
      throw error;
    }

    const user = result.rows[0];
    if (!user) return null;

    return {
      userId: user.user_id,
      tenantId: user.tenant_id,
      siteId: user.site_id ?? undefined,
      role: user.role_name ?? 'USER',
      fullName: user.full_name,
      email: user.email ?? undefined,
      username: user.username,
      passwordHash: user.password_hash,
      permissions: user.permissions ?? [],
    };
  }

  async findActiveUserSecurityById(userId: string, tenantId: string): Promise<{ userId: string; passwordHash: string } | null> {
    const result = await this.db.query<{ user_id: string; password_hash: string }>(
      `SELECT user_id, password_hash
       FROM users
       WHERE user_id=$1 AND tenant_id=$2 AND is_active=true
       LIMIT 1`,
      [userId, tenantId],
    );
    const user = result.rows[0];
    return user ? { userId: user.user_id, passwordHash: user.password_hash } : null;
  }

  async updatePasswordHash(userId: string, tenantId: string, passwordHash: string) {
    await this.db.query(
      `UPDATE users
       SET password_hash=$3
       WHERE user_id=$1 AND tenant_id=$2 AND is_active=true`,
      [userId, tenantId, passwordHash],
    );
  }
}
