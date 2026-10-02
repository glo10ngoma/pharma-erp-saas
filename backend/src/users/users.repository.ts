import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type UserRow = {
  user_id: string;
  tenant_id: string;
  site_id: string | null;
  role_id: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  post_name: string | null;
  gender: string | null;
  birth_date: string | null;
  job_title: string | null;
  employee_number: string | null;
  department: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  role_name: string | null;
  site_name: string | null;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<UserRow>(
      `
      SELECT
        u.user_id,
        u.tenant_id,
        u.site_id,
        u.role_id,
        u.full_name,
        u.first_name,
        u.last_name,
        u.post_name,
        u.gender,
        u.birth_date,
        u.job_title,
        u.employee_number,
        u.department,
        u.username,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        r.role_name,
        s.site_name
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id AND r.tenant_id = u.tenant_id
      LEFT JOIN sites s ON s.site_id = u.site_id AND s.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1
        AND ($2::uuid IS NULL OR u.site_id = $2::uuid)
      ORDER BY u.full_name ASC
      `,
      [user.tenantId, user.siteId ?? null],
    );

    return result.rows.map(this.toUser);
  }

  async findOne(user: AuthUser, userId: string) {
    const result = await this.db.query<UserRow>(
      `
      SELECT
        u.user_id,
        u.tenant_id,
        u.site_id,
        u.role_id,
        u.full_name,
        u.first_name,
        u.last_name,
        u.post_name,
        u.gender,
        u.birth_date,
        u.job_title,
        u.employee_number,
        u.department,
        u.username,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        r.role_name,
        s.site_name
      FROM users u
      LEFT JOIN roles r ON r.role_id = u.role_id AND r.tenant_id = u.tenant_id
      LEFT JOIN sites s ON s.site_id = u.site_id AND s.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1 AND u.user_id = $2
        AND ($3::uuid IS NULL OR u.site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, userId, user.siteId ?? null],
    );

    return result.rows[0] ? this.toUser(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    await this.assertTenantRelations(user, dto.roleId, dto.siteId);
    this.assertBirthDateNotFuture(dto.birthDate);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const profile = this.normalizeCreateProfile(dto);

    const createdUserId = await this.db.transaction(async (client) => {
      const employeeNumber = await this.nextEmployeeNumber(user.tenantId, client);
      const result = await client.query<UserRow>(
        `
        INSERT INTO users (
          tenant_id, site_id, role_id, full_name, first_name, last_name, post_name, gender, birth_date,
          job_title, employee_number, department, username, email, phone, password_hash, is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING user_id
        `,
        [
          user.tenantId,
          dto.siteId,
          dto.roleId,
          profile.fullName,
          profile.firstName,
          profile.lastName,
          profile.postName,
          profile.gender,
          profile.birthDate,
          profile.jobTitle,
          employeeNumber,
          profile.department,
          profile.username,
          profile.email,
          profile.phone,
          passwordHash,
          dto.isActive ?? true,
        ],
      );

      return result.rows[0].user_id;
    });

    return this.findOne(user, createdUserId);
  }

  async update(user: AuthUser, userId: string, dto: UpdateUserDto) {
    const current = await this.findOne(user, userId);
    if (!current) return null;

    const roleId = dto.roleId ?? current.roleId;
    const siteId = dto.siteId ?? current.siteId;
    if (roleId && siteId) await this.assertTenantRelations(user, roleId, siteId);
    this.assertBirthDateNotFuture(dto.birthDate);
    const profile = this.normalizeUpdateProfile(dto, current);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    await this.db.query(
      `
      UPDATE users
      SET
        site_id = $3,
        role_id = $4,
        full_name = $5,
        first_name = $6,
        last_name = $7,
        post_name = $8,
        gender = $9,
        birth_date = $10,
        job_title = $11,
        employee_number = $12,
        department = $13,
        username = $14,
        email = $15,
        phone = $16,
        password_hash = COALESCE($17, password_hash),
        is_active = $18
      WHERE tenant_id = $1 AND user_id = $2
        AND ($19::uuid IS NULL OR site_id = $19::uuid)
      `,
      [
        user.tenantId,
        userId,
        siteId,
        roleId,
        profile.fullName,
        profile.firstName,
        profile.lastName,
        profile.postName,
        profile.gender,
        profile.birthDate,
        profile.jobTitle,
        profile.employeeNumber,
        profile.department,
        profile.username,
        profile.email,
        profile.phone,
        passwordHash,
        dto.isActive ?? current.isActive,
        user.siteId ?? null,
      ],
    );

    return this.findOne(user, userId);
  }

  async remove(user: AuthUser, userId: string) {
    const result = await this.db.query<UserRow>(
      `
      UPDATE users
      SET is_active = false
      WHERE tenant_id = $1 AND user_id = $2
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      RETURNING
        user_id,
        tenant_id,
        site_id,
        role_id,
        full_name,
        first_name,
        last_name,
        post_name,
        gender,
        birth_date,
        job_title,
        employee_number,
        department,
        username,
        email,
        phone,
        is_active,
        last_login_at,
        created_at,
        NULL::text AS role_name,
        NULL::text AS site_name
      `,
      [user.tenantId, userId, user.siteId ?? null],
    );

    return result.rows[0] ? this.findOne(user, result.rows[0].user_id) : null;
  }

  async countActiveAdmins(user: AuthUser, excludedUserId?: string) {
    const result = await this.db.query<{ total: number }>(
      `
      SELECT COUNT(*)::int AS total
      FROM users u
      INNER JOIN roles r ON r.role_id = u.role_id AND r.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1
        AND u.is_active = true
        AND r.is_active = true
        AND UPPER(r.role_name) = 'ADMIN'
        AND ($2::uuid IS NULL OR u.user_id <> $2::uuid)
      `,
      [user.tenantId, excludedUserId ?? null],
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  private async assertTenantRelations(user: AuthUser, roleId: string, siteId: string) {
    if (user.siteId && user.siteId !== siteId) {
      throw new Error('SITE_NOT_ALLOWED');
    }

    const result = await this.db.query<{ roles_count: string; sites_count: string }>(
      `
      SELECT
        (SELECT COUNT(*) FROM roles WHERE tenant_id = $1 AND role_id = $2 AND is_active = true)::int AS roles_count,
        (SELECT COUNT(*) FROM sites WHERE tenant_id = $1 AND site_id = $3 AND is_active = true)::int AS sites_count
      `,
      [user.tenantId, roleId, siteId],
    );

    if (Number(result.rows[0]?.roles_count ?? 0) !== 1) {
      throw new Error('ROLE_NOT_IN_TENANT');
    }

    if (Number(result.rows[0]?.sites_count ?? 0) !== 1) {
      throw new Error('SITE_NOT_IN_TENANT');
    }
  }

  private normalizeCreateProfile(dto: CreateUserDto) {
    const firstName = this.requiredText(dto.firstName);
    const lastName = this.requiredText(dto.lastName);
    const postName = this.optionalText(dto.postName);
    const fullName = this.buildFullName(firstName, lastName, postName) || this.requiredText(dto.fullName);
    const email = this.requiredText(dto.email).toLowerCase();

    return {
      fullName,
      firstName,
      lastName,
      postName,
      gender: this.optionalText(dto.gender),
      birthDate: this.optionalText(dto.birthDate),
      jobTitle: this.requiredText(dto.jobTitle),
      department: this.optionalText(dto.department),
      username: this.optionalText(dto.username)?.toLowerCase() ?? email,
      email,
      phone: this.optionalText(dto.phone),
    };
  }

  private normalizeUpdateProfile(dto: UpdateUserDto, current: ReturnType<UsersRepository['toUser']>) {
    const firstName = dto.firstName === undefined ? current.firstName : this.optionalText(dto.firstName);
    const lastName = dto.lastName === undefined ? current.lastName : this.optionalText(dto.lastName);
    const postName = dto.postName === undefined ? current.postName : this.optionalText(dto.postName);
    const fullNameFromParts = firstName && lastName ? this.buildFullName(firstName, lastName, postName) : null;
    const email = dto.email === undefined ? current.email : this.optionalText(dto.email)?.toLowerCase() ?? null;

    return {
      fullName: fullNameFromParts ?? this.optionalText(dto.fullName) ?? current.fullName,
      firstName,
      lastName,
      postName,
      gender: dto.gender === undefined ? current.gender : this.optionalText(dto.gender),
      birthDate: dto.birthDate === undefined ? current.birthDate : this.optionalText(dto.birthDate),
      jobTitle: dto.jobTitle === undefined ? current.jobTitle : this.optionalText(dto.jobTitle),
      employeeNumber: current.employeeNumber,
      department: dto.department === undefined ? current.department : this.optionalText(dto.department),
      username: dto.username === undefined ? current.username : this.optionalText(dto.username)?.toLowerCase() ?? current.username,
      email,
      phone: dto.phone === undefined ? current.phone : this.optionalText(dto.phone),
    };
  }

  private assertBirthDateNotFuture(value?: string) {
    const birthDate = this.optionalText(value);
    if (!birthDate) return;
    const parsed = new Date(`${birthDate}T00:00:00.000Z`);
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (parsed > todayUtc) {
      throw new Error('BIRTH_DATE_IN_FUTURE');
    }
  }

  private async nextEmployeeNumber(tenantId: string, client: Pick<DatabaseService, 'query'>) {
    const enabled = await client.query<{ enabled: boolean }>(
      `
      SELECT COALESCE(
        (
          SELECT lower(setting_value) IN ('true', '1', 'yes', 'on')
          FROM tenant_settings
          WHERE tenant_id = $1
            AND setting_key = 'EMPLOYEE_NUMBERS_ENABLED'
          LIMIT 1
        ),
        false
      ) AS enabled
      `,
      [tenantId],
    );

    if (!enabled.rows[0]?.enabled) return null;

    const result = await client.query<{ next_number: number }>(
      `
      WITH current_seed AS (
        SELECT COALESCE(
          MAX(substring(employee_number from '^EMP-([0-9]{6})$')::int),
          0
        ) AS current_max
        FROM users
        WHERE tenant_id = $1
          AND employee_number ~ '^EMP-[0-9]{6}$'
      )
      INSERT INTO user_employee_counters (tenant_id, last_number)
      SELECT $1, current_max + 1
      FROM current_seed
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        last_number = user_employee_counters.last_number + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING last_number AS next_number
      `,
      [tenantId],
    );

    return `EMP-${String(result.rows[0].next_number).padStart(6, '0')}`;
  }

  private buildFullName(firstName: string, lastName: string, postName: string | null) {
    return [firstName, lastName, postName].map((part) => part?.trim()).filter(Boolean).join(' ');
  }

  private requiredText(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private optionalText(value?: string | null) {
    const normalized = value?.trim().replace(/\s+/g, ' ');
    return normalized || null;
  }

  private toUser(row: UserRow) {
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      roleId: row.role_id,
      fullName: row.full_name,
      firstName: row.first_name,
      lastName: row.last_name,
      postName: row.post_name,
      gender: row.gender,
      birthDate: row.birth_date,
      jobTitle: row.job_title,
      employeeNumber: row.employee_number,
      department: row.department,
      username: row.username,
      email: row.email,
      phone: row.phone,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      roleName: row.role_name,
      siteName: row.site_name,
    };
  }
}
