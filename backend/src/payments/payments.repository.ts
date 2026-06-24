import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: DatabaseService) {}
  async findAll(user: AuthUser) {
    const r = await this.db.query(`SELECT p.payment_id, p.tenant_id, p.sale_id, p.payment_date, p.payment_method_id, pm.method_name, p.currency_id, c.currency_code, CASE WHEN c.currency_code='CDF' THEN 'FC' WHEN c.currency_code='USD' THEN '$' ELSE c.currency_code END AS currency_symbol, p.amount, p.reference_payment, p.received_by FROM payments p JOIN sales s ON s.sale_id=p.sale_id AND s.tenant_id=p.tenant_id JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id LEFT JOIN currencies c ON c.currency_id=p.currency_id WHERE p.tenant_id=$1 AND ($2::uuid IS NULL OR s.site_id=$2::uuid) ORDER BY p.payment_date DESC`, [user.tenantId, user.siteId ?? null]);
    return r.rows.map(this.toDto);
  }
  async findBySale(user: AuthUser, saleId: string) {
    const r = await this.db.query(`SELECT p.payment_id, p.tenant_id, p.sale_id, p.payment_date, p.payment_method_id, pm.method_name, p.currency_id, c.currency_code, CASE WHEN c.currency_code='CDF' THEN 'FC' WHEN c.currency_code='USD' THEN '$' ELSE c.currency_code END AS currency_symbol, p.amount, p.reference_payment, p.received_by FROM payments p JOIN sales s ON s.sale_id=p.sale_id AND s.tenant_id=p.tenant_id JOIN payment_methods pm ON pm.payment_method_id=p.payment_method_id LEFT JOIN currencies c ON c.currency_id=p.currency_id WHERE p.tenant_id=$1 AND p.sale_id=$2 AND ($3::uuid IS NULL OR s.site_id=$3::uuid) ORDER BY p.payment_date`, [user.tenantId, saleId, user.siteId ?? null]);
    return r.rows.map(this.toDto);
  }
  private toDto(row: any) { return { paymentId: row.payment_id, tenantId: row.tenant_id, saleId: row.sale_id, paymentDate: row.payment_date, paymentMethodId: row.payment_method_id, methodName: row.method_name, currencyId: row.currency_id, currencyCode: row.currency_code, currencySymbol: row.currency_symbol, amount: Number(row.amount), referencePayment: row.reference_payment, receivedBy: row.received_by }; }
}
