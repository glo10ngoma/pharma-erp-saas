import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

type Row = { organization_id: string; tenant_id: string; organization_code: string; organization_name: string; organization_type: string; phone: string | null; email: string | null; address: string | null; rccm: string | null; nif: string | null; credit_allowed: boolean; credit_limit: string; payment_terms_days: number; is_active: boolean; created_at: Date };

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const r = await this.db.query<Row>(`SELECT organization_id, tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active, created_at FROM organizations WHERE tenant_id=$1 ORDER BY organization_name`, [user.tenantId]);
    return r.rows.map(this.toDto);
  }

  async findOne(user: AuthUser, id: string) {
    const r = await this.db.query<Row>(`SELECT organization_id, tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active, created_at FROM organizations WHERE tenant_id=$1 AND organization_id=$2 LIMIT 1`, [user.tenantId, id]);
    return r.rows[0] ? this.toDto(r.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateOrganizationDto) {
    const r = await this.db.query<Row>(
      `INSERT INTO organizations (tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING organization_id, tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active, created_at`,
      [user.tenantId, dto.organizationCode, dto.organizationName, dto.organizationType, dto.phone ?? null, dto.email ?? null, dto.address ?? null, dto.rccm ?? null, dto.nif ?? null, dto.creditAllowed ?? true, dto.creditLimit ?? 0, dto.paymentTermsDays ?? 30, dto.isActive ?? true],
    );
    return this.toDto(r.rows[0]);
  }

  async update(user: AuthUser, id: string, dto: UpdateOrganizationDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    const r = await this.db.query<Row>(
      `UPDATE organizations SET organization_code=$3, organization_name=$4, organization_type=$5, phone=$6, email=$7, address=$8, rccm=$9, nif=$10, credit_allowed=$11, credit_limit=$12, payment_terms_days=$13, is_active=$14
       WHERE tenant_id=$1 AND organization_id=$2
       RETURNING organization_id, tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active, created_at`,
      [user.tenantId, id, dto.organizationCode ?? current.organizationCode, dto.organizationName ?? current.organizationName, dto.organizationType ?? current.organizationType, dto.phone ?? current.phone, dto.email ?? current.email, dto.address ?? current.address, dto.rccm ?? current.rccm, dto.nif ?? current.nif, dto.creditAllowed ?? current.creditAllowed, dto.creditLimit ?? current.creditLimit, dto.paymentTermsDays ?? current.paymentTermsDays, dto.isActive ?? current.isActive],
    );
    return r.rows[0] ? this.toDto(r.rows[0]) : null;
  }

  async disable(user: AuthUser, id: string) {
    const r = await this.db.query<Row>(`UPDATE organizations SET is_active=false WHERE tenant_id=$1 AND organization_id=$2 RETURNING organization_id, tenant_id, organization_code, organization_name, organization_type, phone, email, address, rccm, nif, credit_allowed, credit_limit, payment_terms_days, is_active, created_at`, [user.tenantId, id]);
    return r.rows[0] ? this.toDto(r.rows[0]) : null;
  }

  private toDto(row: Row) {
    return { organizationId: row.organization_id, tenantId: row.tenant_id, organizationCode: row.organization_code, organizationName: row.organization_name, organizationType: row.organization_type, phone: row.phone, email: row.email, address: row.address, rccm: row.rccm, nif: row.nif, creditAllowed: row.credit_allowed, creditLimit: Number(row.credit_limit), paymentTermsDays: row.payment_terms_days, isActive: row.is_active, createdAt: row.created_at };
  }
}
