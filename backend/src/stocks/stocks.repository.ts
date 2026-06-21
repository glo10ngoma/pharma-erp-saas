import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type StockRow = { stock_id: string; tenant_id: string; site_id: string; site_name: string | null; lot_id: string; lot_number: string; expiry_date: string; article_id: string; article_code: string | null; commercial_name: string | null; quantity_available: string; quantity_reserved: string; stock_min: string; stock_max: string | null; updated_at: Date };

@Injectable()
export class StocksRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) { const r = await this.db.query<StockRow>(this.baseSql('WHERE st.tenant_id=$1 AND ($2::uuid IS NULL OR st.site_id=$2::uuid) ORDER BY a.commercial_name, l.expiry_date'), [user.tenantId, user.siteId ?? null]); return r.rows.map(this.toDto); }
  async findByArticle(user: AuthUser, articleId: string) { const r = await this.db.query<StockRow>(this.baseSql('WHERE st.tenant_id=$1 AND l.article_id=$2 AND ($3::uuid IS NULL OR st.site_id=$3::uuid) ORDER BY l.expiry_date'), [user.tenantId, articleId, user.siteId ?? null]); return r.rows.map(this.toDto); }
  private baseSql(where: string) { return `SELECT st.stock_id, st.tenant_id, st.site_id, s.site_name, st.lot_id, l.lot_number, l.expiry_date, l.article_id, a.article_code, a.commercial_name, st.quantity_available, st.quantity_reserved, st.stock_min, st.stock_max, st.updated_at FROM stocks st JOIN lots l ON l.lot_id=st.lot_id AND l.tenant_id=st.tenant_id JOIN articles a ON a.article_id=l.article_id AND a.tenant_id=st.tenant_id JOIN sites s ON s.site_id=st.site_id AND s.tenant_id=st.tenant_id ${where}`; }
  private toDto(row: StockRow) { return { stockId: row.stock_id, tenantId: row.tenant_id, siteId: row.site_id, siteName: row.site_name, lotId: row.lot_id, lotNumber: row.lot_number, expiryDate: row.expiry_date, articleId: row.article_id, articleCode: row.article_code, commercialName: row.commercial_name, quantityAvailable: Number(row.quantity_available), quantityReserved: Number(row.quantity_reserved), stockMin: Number(row.stock_min), stockMax: row.stock_max === null ? null : Number(row.stock_max), updatedAt: row.updated_at }; }
}
