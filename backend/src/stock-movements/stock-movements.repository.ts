import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type Row = { movement_id: string; tenant_id: string; movement_date: Date; site_id: string; site_name: string | null; article_id: string; article_code: string | null; commercial_name: string | null; lot_id: string | null; lot_number: string | null; movement_type: string; quantity: string; reference_type: string | null; reference_id: string | null; notes: string | null; user_id: string | null };

@Injectable()
export class StockMovementsRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<Row>(`SELECT sm.movement_id, sm.tenant_id, sm.movement_date, sm.site_id, s.site_name, sm.article_id, a.article_code, a.commercial_name, sm.lot_id, l.lot_number, sm.movement_type, sm.quantity, sm.reference_type, sm.reference_id, sm.notes, sm.user_id FROM stock_movements sm JOIN sites s ON s.site_id=sm.site_id AND s.tenant_id=sm.tenant_id JOIN articles a ON a.article_id=sm.article_id AND a.tenant_id=sm.tenant_id LEFT JOIN lots l ON l.lot_id=sm.lot_id AND l.tenant_id=sm.tenant_id WHERE sm.tenant_id=$1 AND ($2::uuid IS NULL OR sm.site_id=$2::uuid) ORDER BY sm.movement_date DESC LIMIT 200`, [user.tenantId, user.siteId ?? null]); return r.rows.map(this.toDto); }
  private toDto(row: Row) { return { movementId: row.movement_id, tenantId: row.tenant_id, movementDate: row.movement_date, siteId: row.site_id, siteName: row.site_name, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, lotId: row.lot_id, lotNumber: row.lot_number, movementType: row.movement_type, quantity: Number(row.quantity), referenceType: row.reference_type, referenceId: row.reference_id, notes: row.notes, userId: row.user_id }; }
}
