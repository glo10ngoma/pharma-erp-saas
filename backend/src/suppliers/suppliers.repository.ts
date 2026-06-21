import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

type Row = { supplier_id: string; tenant_id: string; supplier_code: string; supplier_name: string; phone: string | null; email: string | null; address: string | null; rccm: string | null; nif: string | null; is_active: boolean; created_at: Date };

@Injectable()
export class SuppliersRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(`SELECT supplier_id, tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active, created_at FROM suppliers WHERE tenant_id=$1 ORDER BY supplier_name`, [user.tenantId]); return r.rows.map(this.toDto); }
  async findOne(user: AuthUser, id: string) { const r = await this.db.query<Row>(`SELECT supplier_id, tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active, created_at FROM suppliers WHERE tenant_id=$1 AND supplier_id=$2 LIMIT 1`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async create(user: AuthUser, dto: CreateSupplierDto) { const r = await this.db.query<Row>(`INSERT INTO suppliers (tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING supplier_id, tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active, created_at`, [user.tenantId, dto.supplierCode, dto.supplierName, dto.phone ?? null, dto.email ?? null, dto.address ?? null, dto.rccm ?? null, dto.nif ?? null, dto.isActive ?? true]); return this.toDto(r.rows[0]); }
  async update(user: AuthUser, id: string, dto: UpdateSupplierDto) { const c = await this.findOne(user, id); if (!c) return null; const r = await this.db.query<Row>(`UPDATE suppliers SET supplier_code=$3, supplier_name=$4, phone=$5, email=$6, address=$7, rccm=$8, nif=$9, is_active=$10 WHERE tenant_id=$1 AND supplier_id=$2 RETURNING supplier_id, tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active, created_at`, [user.tenantId, id, dto.supplierCode ?? c.supplierCode, dto.supplierName ?? c.supplierName, dto.phone ?? c.phone, dto.email ?? c.email, dto.address ?? c.address, dto.rccm ?? c.rccm, dto.nif ?? c.nif, dto.isActive ?? c.isActive]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async remove(user: AuthUser, id: string) { const r = await this.db.query<Row>(`UPDATE suppliers SET is_active=false WHERE tenant_id=$1 AND supplier_id=$2 RETURNING supplier_id, tenant_id, supplier_code, supplier_name, phone, email, address, rccm, nif, is_active, created_at`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  private toDto(row: Row) { return { supplierId: row.supplier_id, tenantId: row.tenant_id, supplierCode: row.supplier_code, supplierName: row.supplier_name, phone: row.phone, email: row.email, address: row.address, rccm: row.rccm, nif: row.nif, isActive: row.is_active, createdAt: row.created_at }; }
}
