import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type ExchangeRateRow = {
  setting_value: string;
  updated_at: Date | null;
  updated_by_name: string | null;
};

const USD_CDF_RATE_KEY = 'USD_CDF_RATE';
const DEFAULT_USD_CDF_RATE = 2800;

@Injectable()
export class SettingsRepository {
  constructor(private readonly db: DatabaseService) {}

  async getExchangeRate(user: AuthUser) {
    const result = await this.db.query<ExchangeRateRow>(
      `
      SELECT ts.setting_value, ts.updated_at, u.full_name AS updated_by_name
      FROM tenant_settings ts
      LEFT JOIN users u ON u.user_id = ts.updated_by AND u.tenant_id = ts.tenant_id
      WHERE ts.tenant_id = $1
        AND ts.setting_key = $2
      LIMIT 1
      `,
      [user.tenantId, USD_CDF_RATE_KEY],
    );

    const row = result.rows[0];
    return this.toExchangeRate(row);
  }

  async updateExchangeRate(user: AuthUser, rate: number) {
    const result = await this.db.query<ExchangeRateRow>(
      `
      INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
      RETURNING setting_value,
                updated_at,
                (SELECT full_name FROM users WHERE user_id = $4 AND tenant_id = $1) AS updated_by_name
      `,
      [user.tenantId, USD_CDF_RATE_KEY, String(rate), user.userId],
    );

    await this.insertAuditLog(user, rate);
    return this.toExchangeRate(result.rows[0]);
  }

  private toExchangeRate(row?: ExchangeRateRow) {
    return {
      baseCurrency: 'USD',
      quoteCurrency: 'CDF',
      rate: Number(row?.setting_value ?? DEFAULT_USD_CDF_RATE),
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by_name ?? null,
    };
  }

  private async insertAuditLog(user: AuthUser, rate: number) {
    try {
      await this.db.query(
        `
        INSERT INTO audit_logs (tenant_id, user_id, table_name, action_type, new_value)
        VALUES ($1, $2, 'tenant_settings', 'UPDATE', $3::jsonb)
        `,
        [user.tenantId, user.userId, JSON.stringify({ settingKey: USD_CDF_RATE_KEY, rate })],
      );
    } catch {
      // Audit should not block a settings update if an older environment misses audit wiring.
    }
  }
}
