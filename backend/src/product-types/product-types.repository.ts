import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

type Row = { product_type_id: string; tenant_id: string; type_code: string; type_name: string };

@Injectable()
export class ProductTypesRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(`SELECT product_type_id, tenant_id, type_code, type_name FROM product_types WHERE tenant_id=$1 ORDER BY type_name`, [user.tenantId]); return r.rows.map(this.toDto); }
  async findOne(user: AuthUser, id: string) { const r = await this.db.query<Row>(`SELECT product_type_id, tenant_id, type_code, type_name FROM product_types WHERE tenant_id=$1 AND product_type_id=$2 LIMIT 1`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async create(user: AuthUser, dto: CreateProductTypeDto) { const r = await this.db.query<Row>(`INSERT INTO product_types (tenant_id, type_code, type_name) VALUES ($1,$2,$3) RETURNING product_type_id, tenant_id, type_code, type_name`, [user.tenantId, dto.typeCode, dto.typeName]); return this.toDto(r.rows[0]); }
  async update(user: AuthUser, id: string, dto: UpdateProductTypeDto) { const c = await this.findOne(user, id); if (!c) return null; const r = await this.db.query<Row>(`UPDATE product_types SET type_code=$3, type_name=$4 WHERE tenant_id=$1 AND product_type_id=$2 RETURNING product_type_id, tenant_id, type_code, type_name`, [user.tenantId, id, dto.typeCode ?? c.typeCode, dto.typeName ?? c.typeName]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async remove(user: AuthUser, id: string) { const r = await this.db.query<Row>(`DELETE FROM product_types WHERE tenant_id=$1 AND product_type_id=$2 RETURNING product_type_id, tenant_id, type_code, type_name`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  private toDto(row: Row) { return { productTypeId: row.product_type_id, tenantId: row.tenant_id, typeCode: row.type_code, typeName: row.type_name }; }
}
