import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateInsurancePlanDto } from './dto/create-insurance-plan.dto';
import { UpdateInsurancePlanDto } from './dto/update-insurance-plan.dto';

type Row = { plan_id: string; tenant_id: string; organization_id: string; organization_name: string | null; plan_code: string; plan_name: string; coverage_percent: string; patient_copay_percent: string; monthly_limit: string | null; annual_limit: string | null; requires_authorization: boolean; is_active: boolean };

@Injectable()
export class InsurancePlansRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(this.baseSql('WHERE o.tenant_id=$1 ORDER BY o.organization_name, ip.plan_name'), [user.tenantId]); return r.rows.map(this.toDto); }
  async findOne(user: AuthUser, id: string) { const r = await this.db.query<Row>(this.baseSql('WHERE o.tenant_id=$1 AND ip.plan_id=$2 LIMIT 1'), [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async create(user: AuthUser, dto: CreateInsurancePlanDto) {
    await this.assertOrganization(user, dto.organizationId);
    const coverage = dto.coveragePercent;
    const copay = dto.patientCopayPercent ?? 100 - coverage;
    const r = await this.db.query<Row>(
      `INSERT INTO insurance_plans (organization_id, plan_code, plan_name, coverage_percent, patient_copay_percent, monthly_limit, annual_limit, requires_authorization, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING plan_id, $10::uuid AS tenant_id, organization_id, NULL::text AS organization_name, plan_code, plan_name, coverage_percent, patient_copay_percent, monthly_limit, annual_limit, requires_authorization, is_active`,
      [dto.organizationId, dto.planCode, dto.planName, coverage, copay, dto.monthlyLimit ?? null, dto.annualLimit ?? null, dto.requiresAuthorization ?? false, dto.isActive ?? true, user.tenantId],
    );
    return this.findOne(user, r.rows[0].plan_id);
  }
  async update(user: AuthUser, id: string, dto: UpdateInsurancePlanDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    const organizationId = dto.organizationId ?? current.organizationId;
    await this.assertOrganization(user, organizationId);
    const coverage = dto.coveragePercent ?? current.coveragePercent;
    const copay = dto.patientCopayPercent ?? (dto.coveragePercent === undefined ? current.patientCopayPercent : 100 - coverage);
    await this.db.query(
      `UPDATE insurance_plans SET organization_id=$3, plan_code=$4, plan_name=$5, coverage_percent=$6, patient_copay_percent=$7, monthly_limit=$8, annual_limit=$9, requires_authorization=$10, is_active=$11
       WHERE plan_id=$2 AND EXISTS (SELECT 1 FROM organizations o WHERE o.organization_id=insurance_plans.organization_id AND o.tenant_id=$1)`,
      [user.tenantId, id, organizationId, dto.planCode ?? current.planCode, dto.planName ?? current.planName, coverage, copay, dto.monthlyLimit ?? current.monthlyLimit, dto.annualLimit ?? current.annualLimit, dto.requiresAuthorization ?? current.requiresAuthorization, dto.isActive ?? current.isActive],
    );
    return this.findOne(user, id);
  }
  private baseSql(where: string) { return `SELECT ip.plan_id, o.tenant_id, ip.organization_id, o.organization_name, ip.plan_code, ip.plan_name, ip.coverage_percent, ip.patient_copay_percent, ip.monthly_limit, ip.annual_limit, ip.requires_authorization, ip.is_active FROM insurance_plans ip JOIN organizations o ON o.organization_id=ip.organization_id ${where}`; }
  private async assertOrganization(user: AuthUser, id: string) { const r = await this.db.query<{ total: string }>(`SELECT COUNT(*)::int AS total FROM organizations WHERE tenant_id=$1 AND organization_id=$2 AND is_active=true`, [user.tenantId, id]); if (Number(r.rows[0]?.total ?? 0) !== 1) throw new Error('ORGANIZATION_NOT_IN_TENANT'); }
  private toDto(row: Row) { return { planId: row.plan_id, tenantId: row.tenant_id, organizationId: row.organization_id, organizationName: row.organization_name, planCode: row.plan_code, planName: row.plan_name, coveragePercent: Number(row.coverage_percent), patientCopayPercent: Number(row.patient_copay_percent), monthlyLimit: row.monthly_limit === null ? null : Number(row.monthly_limit), annualLimit: row.annual_limit === null ? null : Number(row.annual_limit), requiresAuthorization: row.requires_authorization, isActive: row.is_active }; }
}
