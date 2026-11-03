import { Injectable, Logger } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
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
      this.logger.error(`AUTH_LOGIN_QUERY_FAILED ${JSON.stringify(this.serializeError(error))}`);
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

  async findActiveUserHomeById(userId: string, homeTenantId: string): Promise<Omit<UserWithSecurity, 'passwordHash'> | null> {
    return this.findActiveUserById(userId, homeTenantId);
  }

  async findActiveUserById(userId: string, tenantId: string): Promise<Omit<UserWithSecurity, 'passwordHash'> | null> {
    const result = await this.db.query<{
      user_id: string;
      tenant_id: string;
      site_id: string | null;
      role_name: string | null;
      full_name: string;
      email: string | null;
      username: string;
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
      GROUP BY u.user_id, u.tenant_id, u.site_id, r.role_name, u.full_name, u.email, u.username
      LIMIT 1
      `,
      [userId, tenantId],
    );

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
      permissions: user.permissions ?? [],
    };
  }

  async findAccessibleTenants(user: AuthUser) {
    if (user.role === 'SUPER_ADMIN') {
      const result = await this.db.query<{ tenant_id: string; tenant_code: string | null; tenant_name: string }>(
        `
        SELECT tenant_id, tenant_code, tenant_name
        FROM tenants
        WHERE COALESCE(is_active, true) = true
          AND COALESCE(subscription_status, 'ACTIVE') <> 'SUSPENDED'
        ORDER BY tenant_name ASC
        `,
      );
      return result.rows.map((row) => ({
        id: row.tenant_id,
        code: row.tenant_code,
        name: row.tenant_name,
      }));
    }

    const result = await this.db.query<{ tenant_id: string; tenant_code: string | null; tenant_name: string }>(
      `
      SELECT DISTINCT t.tenant_id, t.tenant_code, t.tenant_name
      FROM user_tenant_memberships utm
      JOIN tenants t ON t.tenant_id = utm.tenant_id
      WHERE utm.user_id = $1
        AND utm.is_active = true
        AND COALESCE(t.is_active, true) = true
        AND COALESCE(t.subscription_status, 'ACTIVE') <> 'SUSPENDED'
      ORDER BY t.tenant_name ASC
      `,
      [user.userId],
    );
    return result.rows.map((row) => ({
      id: row.tenant_id,
      code: row.tenant_code,
      name: row.tenant_name,
    }));
  }

  async findAccessibleSites(user: AuthUser, tenantId: string) {
    if (user.role === 'SUPER_ADMIN') {
      const result = await this.db.query<{ site_id: string; site_code: string | null; site_name: string }>(
        `
        SELECT site_id, site_code, site_name
        FROM sites
        WHERE tenant_id = $1
          AND is_active = true
        ORDER BY site_name ASC
        `,
        [tenantId],
      );
      return result.rows.map((row) => ({
        id: row.site_id,
        code: row.site_code,
        name: row.site_name,
      }));
    }

    const result = await this.db.query<{ site_id: string; site_code: string | null; site_name: string }>(
      `
      SELECT DISTINCT s.site_id, s.site_code, s.site_name
      FROM user_site_assignments usa
      JOIN sites s ON s.site_id = usa.site_id AND s.tenant_id = usa.tenant_id
      WHERE usa.user_id = $1
        AND usa.tenant_id = $2
        AND usa.is_active = true
        AND s.is_active = true
      ORDER BY s.site_name ASC
      `,
      [user.userId, tenantId],
    );
    return result.rows.map((row) => ({
      id: row.site_id,
      code: row.site_code,
      name: row.site_name,
    }));
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

  private serializeError(error: unknown) {
    if (!(error instanceof Error)) return { value: String(error) };
    const anyError = error as Error & {
      code?: string;
      errno?: string | number;
      address?: string;
      port?: string | number;
      cause?: unknown;
      errors?: unknown[];
    };
    return {
      name: anyError.name,
      message: anyError.message,
      code: anyError.code,
      errno: anyError.errno,
      address: anyError.address,
      port: anyError.port,
      cause: this.serializeNested(anyError.cause),
      errors: Array.isArray(anyError.errors) ? anyError.errors.map((entry) => this.serializeNested(entry)) : undefined,
      stack: this.isDev() ? anyError.stack : undefined,
      db: this.db.connectionSummary(),
    };
  }

  private serializeNested(value: unknown): unknown {
    if (value instanceof Error) {
      const nested = value as Error & {
        code?: string;
        errno?: string | number;
        address?: string;
        port?: string | number;
        cause?: unknown;
      };
      return {
        name: nested.name,
        message: nested.message,
        code: nested.code,
        errno: nested.errno,
        address: nested.address,
        port: nested.port,
        cause: nested.cause ? this.serializeNested(nested.cause) : undefined,
        stack: this.isDev() ? nested.stack : undefined,
      };
    }
    return value;
  }

  private isDev() {
    return (process.env.APP_ENV ?? 'development') !== 'production' && (process.env.NODE_ENV ?? 'development') !== 'production';
  }
}
