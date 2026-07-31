import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { SendMessageDto } from './dto/send-message.dto';

type ThreadRow = {
  thread_id: string;
  tenant_id: string;
  site_id: string | null;
  site_name: string | null;
  title: string;
  thread_type: string;
  created_by: string | null;
  created_by_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  unread_count: string;
  participant_count: string;
  last_message_text: string | null;
  last_message_at: Date | null;
};

type MessageRow = {
  message_id: string;
  tenant_id: string;
  thread_id: string;
  author_id: string;
  author_name: string | null;
  site_id: string | null;
  message_type: string;
  message_text: string;
  cash_session_id: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

@Injectable()
export class InternalChatRepository {
  constructor(private readonly db: DatabaseService) {}

  async listThreads(user: AuthUser) {
    const result = await this.db.query<ThreadRow>(
      `
      SELECT
        t.thread_id, t.tenant_id, t.site_id, s.site_name, t.title, t.thread_type, t.created_by,
        creator.full_name AS created_by_name, t.is_active, t.created_at, t.updated_at,
        COUNT(DISTINCT p.user_id)::int AS participant_count,
        COUNT(DISTINCT CASE WHEN pself.last_read_at IS NULL OR m.created_at > pself.last_read_at THEN m.message_id END)::int AS unread_count,
        MAX(m.created_at) AS last_message_at,
        (
          SELECT m2.message_text
          FROM chat_messages m2
          WHERE m2.thread_id = t.thread_id AND m2.deleted_at IS NULL
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS last_message_text
      FROM chat_threads t
      JOIN chat_thread_participants pself ON pself.thread_id = t.thread_id AND pself.user_id = $2
      LEFT JOIN chat_thread_participants p ON p.thread_id = t.thread_id
      LEFT JOIN chat_messages m ON m.thread_id = t.thread_id AND m.deleted_at IS NULL
      LEFT JOIN users creator ON creator.user_id = t.created_by AND creator.tenant_id = t.tenant_id
      LEFT JOIN sites s ON s.site_id = t.site_id AND s.tenant_id = t.tenant_id
      WHERE t.tenant_id = $1
        AND t.is_active = true
        AND ($3::uuid IS NULL OR t.site_id IS NULL OR t.site_id = $3::uuid)
      GROUP BY t.thread_id, t.tenant_id, t.site_id, s.site_name, t.title, t.thread_type, t.created_by, creator.full_name, t.is_active, t.created_at, t.updated_at
      ORDER BY COALESCE(MAX(m.created_at), t.updated_at) DESC, t.created_at DESC
      `,
      [user.tenantId, user.userId, user.siteId ?? null],
    );
    return result.rows.map((row) => this.toThread(row));
  }

  async createThread(user: AuthUser, dto: CreateThreadDto) {
    if (dto.siteId) await this.assertSiteAllowed(user, dto.siteId);
    const participantIds = Array.from(new Set([user.userId, ...(dto.participantIds ?? [])]));
    const inserted = await this.db.transaction(async (client) => {
      const thread = await client.query<{ thread_id: string }>(
        `
        INSERT INTO chat_threads (tenant_id, site_id, title, thread_type, created_by)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING thread_id
        `,
        [user.tenantId, dto.siteId ?? user.siteId ?? null, dto.title.trim(), dto.threadType ?? 'DIRECT', user.userId],
      );

      for (let index = 0; index < participantIds.length; index += 1) {
        await client.query(
          `
          INSERT INTO chat_thread_participants (thread_id, user_id, role_code)
          VALUES ($1, $2, $3)
          ON CONFLICT (thread_id, user_id) DO NOTHING
          `,
          [thread.rows[0].thread_id, participantIds[index], index === 0 ? 'OWNER' : 'MEMBER'],
        );
      }

      await client.query(
        `
        INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
        VALUES ($1,$2,$3,'chat_threads',$4,'INSERT',$5::jsonb)
        `,
        [user.tenantId, dto.siteId ?? user.siteId ?? null, user.userId, thread.rows[0].thread_id, JSON.stringify(dto)],
      );

      return thread.rows[0].thread_id;
    });

    return this.findThread(user, inserted);
  }

  async findThread(user: AuthUser, threadId: string) {
    const threads = await this.listThreads(user);
    return threads.find((thread) => thread.threadId === threadId) ?? null;
  }

  async listMessages(user: AuthUser, threadId: string) {
    await this.assertMembership(user, threadId);
    const result = await this.db.query<MessageRow>(
      `
      SELECT
        m.message_id, m.tenant_id, m.thread_id, m.author_id, u.full_name AS author_name,
        m.site_id, m.message_type, m.message_text, m.cash_session_id, m.workstation_id,
        m.workstation_name, m.created_at, m.updated_at, m.deleted_at
      FROM chat_messages m
      LEFT JOIN users u ON u.user_id = m.author_id AND u.tenant_id = m.tenant_id
      WHERE m.tenant_id = $1
        AND m.thread_id = $2
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
      `,
      [user.tenantId, threadId],
    );
    await this.db.query(
      `UPDATE chat_thread_participants SET last_read_at = CURRENT_TIMESTAMP WHERE thread_id = $1 AND user_id = $2`,
      [threadId, user.userId],
    );
    return result.rows.map((row) => this.toMessage(row));
  }

  async sendMessage(user: AuthUser, threadId: string, dto: SendMessageDto) {
    await this.assertMembership(user, threadId);
    const workstation = dto.workstationId ? await this.findWorkstation(user.tenantId, dto.workstationId) : null;
    const inserted = await this.db.transaction(async (client) => {
      const message = await client.query<{ message_id: string }>(
        `
        INSERT INTO chat_messages (
          tenant_id, thread_id, author_id, site_id, message_type, message_text,
          cash_session_id, workstation_id, workstation_name
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING message_id
        `,
        [
          user.tenantId,
          threadId,
          user.userId,
          user.siteId ?? null,
          dto.messageType ?? 'TEXT',
          dto.messageText.trim(),
          dto.cashSessionId ?? null,
          dto.workstationId ?? null,
          workstation?.workstation_name ?? null,
        ],
      );
      await client.query(`UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE thread_id = $1`, [threadId]);
      await client.query(
        `
        INSERT INTO audit_logs (
          tenant_id, site_id, user_id, table_name, record_id, action_type, new_value, cash_session_id, workstation_id, workstation_name
        )
        VALUES ($1,$2,$3,'chat_messages',$4,'INSERT',$5::jsonb,$6,$7,$8)
        `,
        [user.tenantId, user.siteId ?? null, user.userId, message.rows[0].message_id, JSON.stringify(dto), dto.cashSessionId ?? null, dto.workstationId ?? null, workstation?.workstation_name ?? null],
      );
      return message.rows[0].message_id;
    });

    const messages = await this.listMessages(user, threadId);
    return messages.find((message) => message.messageId === inserted) ?? null;
  }

  private async assertMembership(user: AuthUser, threadId: string) {
    const result = await this.db.query<{ total: string }>(
      `
      SELECT COUNT(*)::int AS total
      FROM chat_thread_participants p
      JOIN chat_threads t ON t.thread_id = p.thread_id
      WHERE t.tenant_id = $1 AND p.thread_id = $2 AND p.user_id = $3
      `,
      [user.tenantId, threadId, user.userId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new ForbiddenException('PERMISSION_DENIED');
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new BadRequestException('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id = $1 AND site_id = $2`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('SITE_NOT_IN_TENANT');
  }

  private async findWorkstation(tenantId: string, workstationId: string) {
    const result = await this.db.query<{ workstation_id: string; workstation_name: string }>(
      `SELECT workstation_id, workstation_name FROM pos_workstations WHERE tenant_id = $1 AND workstation_id = $2 LIMIT 1`,
      [tenantId, workstationId],
    );
    if (!result.rows[0]) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    return result.rows[0];
  }

  private toThread(row: ThreadRow) {
    return {
      threadId: row.thread_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      title: row.title,
      threadType: row.thread_type,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      unreadCount: Number(row.unread_count ?? 0),
      participantCount: Number(row.participant_count ?? 0),
      lastMessageText: row.last_message_text,
      lastMessageAt: row.last_message_at,
    };
  }

  private toMessage(row: MessageRow) {
    return {
      messageId: row.message_id,
      tenantId: row.tenant_id,
      threadId: row.thread_id,
      authorId: row.author_id,
      authorName: row.author_name,
      siteId: row.site_id,
      messageType: row.message_type,
      messageText: row.message_text,
      cashSessionId: row.cash_session_id,
      workstationId: row.workstation_id,
      workstationName: row.workstation_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
