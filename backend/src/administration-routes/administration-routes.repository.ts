import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateAdministrationRouteDto } from './dto/create-administration-route.dto';
import { UpdateAdministrationRouteDto } from './dto/update-administration-route.dto';

type Row = { route_id: string; tenant_id: string; route_code: string; route_name: string };

@Injectable()
export class AdministrationRoutesRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(`SELECT route_id, tenant_id, route_code, route_name FROM administration_routes WHERE tenant_id=$1 ORDER BY route_name`, [user.tenantId]); return r.rows.map(this.toDto); }
  async findOne(user: AuthUser, id: string) { const r = await this.db.query<Row>(`SELECT route_id, tenant_id, route_code, route_name FROM administration_routes WHERE tenant_id=$1 AND route_id=$2 LIMIT 1`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async create(user: AuthUser, dto: CreateAdministrationRouteDto) { const r = await this.db.query<Row>(`INSERT INTO administration_routes (tenant_id, route_code, route_name) VALUES ($1,$2,$3) RETURNING route_id, tenant_id, route_code, route_name`, [user.tenantId, dto.routeCode, dto.routeName]); return this.toDto(r.rows[0]); }
  async update(user: AuthUser, id: string, dto: UpdateAdministrationRouteDto) { const c = await this.findOne(user, id); if (!c) return null; const r = await this.db.query<Row>(`UPDATE administration_routes SET route_code=$3, route_name=$4 WHERE tenant_id=$1 AND route_id=$2 RETURNING route_id, tenant_id, route_code, route_name`, [user.tenantId, id, dto.routeCode ?? c.routeCode, dto.routeName ?? c.routeName]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  async remove(user: AuthUser, id: string) { const r = await this.db.query<Row>(`DELETE FROM administration_routes WHERE tenant_id=$1 AND route_id=$2 RETURNING route_id, tenant_id, route_code, route_name`, [user.tenantId, id]); return r.rows[0] ? this.toDto(r.rows[0]) : null; }
  private toDto(row: Row) { return { routeId: row.route_id, tenantId: row.tenant_id, routeCode: row.route_code, routeName: row.route_name }; }
}
