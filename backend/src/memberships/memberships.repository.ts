import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateMembershipDto } from './dto/create-membership.dto';

type Row = { membership_id: string; tenant_id: string; customer_id: string; customer_name: string | null; organization_id: string; organization_name: string | null; plan_id: string | null; plan_name: string | null; coverage_percent: string | null; member_number: string | null; employee_number: string | null; relationship_type: string; valid_from: string | null; valid_to: string | null; is_active: boolean };

@Injectable()
export class MembershipsRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(this.baseSql('WHERE c.tenant_id=$1 ORDER BY c.customer_name'), [user.tenantId]); return r.rows.map(this.toDto); }
  async findByCustomer(user: AuthUser, customerId: string) { const r = await this.db.query<Row>(this.baseSql('WHERE c.tenant_id=$1 AND cm.customer_id=$2 ORDER BY cm.is_active DESC'), [user.tenantId, customerId]); return r.rows.map(this.toDto); }
  async create(user: AuthUser, dto: CreateMembershipDto) {
    await this.assertRelations(user, dto.customerId, dto.organizationId, dto.planId);
    const r = await this.db.query<{ membership_id: string }>(
      `INSERT INTO customer_memberships (tenant_id, customer_id, organization_id, plan_id, member_number, employee_number, relationship_type, valid_from, valid_to, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING membership_id`,
      [user.tenantId, dto.customerId, dto.organizationId, dto.planId ?? null, dto.memberNumber ?? null, dto.employeeNumber ?? null, dto.relationshipType ?? 'MAIN', dto.validFrom ?? null, dto.validTo ?? null, dto.isActive ?? true],
    );
    return this.findOne(user, r.rows[0].membership_id);
  }
  async findOne(user: AuthUser, id: string) { const r = await this.db.query<Row>(this.baseSql('WHERE c.tenant_id=$1 AND cm.membership_id=$2 LIMIT 1'), [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  private baseSql(where: string) { return `SELECT cm.membership_id, c.tenant_id, cm.customer_id, c.customer_name, cm.organization_id, o.organization_name, cm.plan_id, ip.plan_name, ip.coverage_percent, cm.member_number, cm.employee_number, cm.relationship_type, cm.valid_from, cm.valid_to, cm.is_active FROM customer_memberships cm JOIN customers c ON c.customer_id=cm.customer_id AND c.tenant_id=cm.tenant_id JOIN organizations o ON o.organization_id=cm.organization_id AND o.tenant_id=cm.tenant_id LEFT JOIN insurance_plans ip ON ip.plan_id=cm.plan_id AND ip.organization_id=cm.organization_id ${where}`; }
  private async assertRelations(user: AuthUser, customerId: string, organizationId: string, planId?: string) { const r = await this.db.query<{ customers_count: string; organizations_count: string; plans_count: string }>(`SELECT (SELECT COUNT(*) FROM customers WHERE tenant_id=$1 AND customer_id=$2 AND is_active=true)::int AS customers_count, (SELECT COUNT(*) FROM organizations WHERE tenant_id=$1 AND organization_id=$3 AND is_active=true)::int AS organizations_count, (SELECT CASE WHEN $4::uuid IS NULL THEN 1 ELSE COUNT(*) END FROM insurance_plans ip JOIN organizations o ON o.organization_id=ip.organization_id WHERE o.tenant_id=$1 AND ip.organization_id=$3 AND ip.plan_id=$4::uuid AND ip.is_active=true)::int AS plans_count`, [user.tenantId, customerId, organizationId, planId ?? null]); if (Number(r.rows[0]?.customers_count ?? 0) !== 1) throw new Error('CUSTOMER_NOT_IN_TENANT'); if (Number(r.rows[0]?.organizations_count ?? 0) !== 1) throw new Error('ORGANIZATION_NOT_IN_TENANT'); if (Number(r.rows[0]?.plans_count ?? 0) !== 1) throw new Error('INSURANCE_PLAN_NOT_ACTIVE'); }
  private toDto(row: Row) { return { membershipId: row.membership_id, tenantId: row.tenant_id, customerId: row.customer_id, customerName: row.customer_name, organizationId: row.organization_id, organizationName: row.organization_name, planId: row.plan_id, planName: row.plan_name, coveragePercent: row.coverage_percent === null ? null : Number(row.coverage_percent), memberNumber: row.member_number, employeeNumber: row.employee_number, relationshipType: row.relationship_type, validFrom: row.valid_from, validTo: row.valid_to, isActive: row.is_active }; }
}
