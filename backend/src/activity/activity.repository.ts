import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type ActivityRow = {
  occurred_at: Date;
  activity_type: string;
  record_id: string;
  label: string;
  user_name: string | null;
  site_name: string | null;
  workstation_name: string | null;
  cash_session_id: string | null;
};

@Injectable()
export class ActivityRepository {
  constructor(private readonly db: DatabaseService) {}

  async findRecent(user: AuthUser, limit = 50) {
    const result = await this.db.query<ActivityRow>(
      `
      WITH audit_events AS (
        SELECT
          al.action_date AS occurred_at,
          'AUDIT'::text AS activity_type,
          COALESCE(al.record_id::text, al.audit_id::text) AS record_id,
          CONCAT(al.action_type, ' ', al.table_name) AS label,
          u.full_name AS user_name,
          s.site_name AS site_name,
          al.workstation_name,
          al.cash_session_id
        FROM audit_logs al
        LEFT JOIN users u ON u.user_id = al.user_id AND u.tenant_id = al.tenant_id
        LEFT JOIN sites s ON s.site_id = al.site_id AND s.tenant_id = al.tenant_id
        WHERE al.tenant_id = $1
          AND ($2::uuid IS NULL OR al.site_id IS NULL OR al.site_id = $2::uuid)
      ),
      comment_events AS (
        SELECT
          ec.created_at AS occurred_at,
          'COMMENT'::text AS activity_type,
          ec.comment_id::text AS record_id,
          CONCAT('Commentaire ', ec.entity_type) AS label,
          u.full_name AS user_name,
          s.site_name AS site_name,
          ec.workstation_name,
          ec.cash_session_id
        FROM entity_comments ec
        LEFT JOIN users u ON u.user_id = ec.author_id AND u.tenant_id = ec.tenant_id
        LEFT JOIN sites s ON s.site_id = ec.site_id AND s.tenant_id = ec.tenant_id
        WHERE ec.tenant_id = $1
          AND ec.deleted_at IS NULL
          AND ($2::uuid IS NULL OR ec.site_id IS NULL OR ec.site_id = $2::uuid)
      ),
      chat_events AS (
        SELECT
          cm.created_at AS occurred_at,
          'CHAT'::text AS activity_type,
          cm.message_id::text AS record_id,
          CONCAT('Message ', ct.title) AS label,
          u.full_name AS user_name,
          s.site_name AS site_name,
          cm.workstation_name,
          cm.cash_session_id
        FROM chat_messages cm
        JOIN chat_threads ct ON ct.thread_id = cm.thread_id
        LEFT JOIN users u ON u.user_id = cm.author_id AND u.tenant_id = cm.tenant_id
        LEFT JOIN sites s ON s.site_id = cm.site_id AND s.tenant_id = cm.tenant_id
        WHERE cm.tenant_id = $1
          AND cm.deleted_at IS NULL
          AND ($2::uuid IS NULL OR cm.site_id IS NULL OR cm.site_id = $2::uuid)
      )
      SELECT *
      FROM (
        SELECT * FROM audit_events
        UNION ALL
        SELECT * FROM comment_events
        UNION ALL
        SELECT * FROM chat_events
      ) all_events
      ORDER BY occurred_at DESC
      LIMIT $3
      `,
      [user.tenantId, user.siteId ?? null, limit],
    );
    return result.rows.map((row) => ({
      occurredAt: row.occurred_at,
      activityType: row.activity_type,
      recordId: row.record_id,
      label: row.label,
      userName: row.user_name,
      siteName: row.site_name,
      workstationName: row.workstation_name,
      cashSessionId: row.cash_session_id,
    }));
  }
}
