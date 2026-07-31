import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentRow = {
  comment_id: string;
  tenant_id: string;
  site_id: string | null;
  site_name: string | null;
  entity_type: string;
  entity_id: string;
  parent_comment_id: string | null;
  author_id: string;
  author_name: string | null;
  comment_text: string;
  visibility_scope: string;
  cash_session_id: string | null;
  workstation_id: string | null;
  workstation_name: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

const COMMENT_ENTITY_MAP = {
  SALE: { tableName: 'sales', idColumn: 'sale_id', siteColumn: 'site_id' },
  PURCHASE: { tableName: 'purchases', idColumn: 'purchase_id', siteColumn: 'site_id' },
  INVENTORY: { tableName: 'inventory_sessions', idColumn: 'inventory_id', siteColumn: 'site_id' },
  CASH_SESSION: { tableName: 'cash_sessions', idColumn: 'cash_session_id', siteColumn: 'site_id' },
} as const;

type AllowedCommentEntityType = keyof typeof COMMENT_ENTITY_MAP;
const COMMENT_TEXT_MAX_LENGTH = 2000;

@Injectable()
export class CommentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByEntity(user: AuthUser, entityType: string, entityId: string) {
    this.assertEntityType(entityType);
    const result = await this.db.query<CommentRow>(
      `
      SELECT ec.comment_id, ec.tenant_id, ec.site_id, s.site_name, ec.entity_type, ec.entity_id,
             ec.parent_comment_id, ec.author_id, u.full_name AS author_name, ec.comment_text,
             ec.visibility_scope, ec.cash_session_id, ec.workstation_id, ec.workstation_name,
             ec.created_at, ec.updated_at, ec.deleted_at
      FROM entity_comments ec
      LEFT JOIN users u ON u.user_id = ec.author_id AND u.tenant_id = ec.tenant_id
      LEFT JOIN sites s ON s.site_id = ec.site_id AND s.tenant_id = ec.tenant_id
      WHERE ec.tenant_id = $1
        AND ec.entity_type = upper($2)
        AND ec.entity_id = $3::uuid
        AND ec.deleted_at IS NULL
        AND (ec.visibility_scope = 'PUBLIC' OR ec.author_id = $4 OR $5 = true)
        AND ($6::uuid IS NULL OR ec.site_id IS NULL OR ec.site_id = $6::uuid)
      ORDER BY ec.created_at ASC
      `,
      [user.tenantId, entityType, entityId, user.userId, this.canReadPrivate(user), user.siteId ?? null],
    );
    return result.rows.map((row) => this.toComment(row));
  }

  async create(user: AuthUser, dto: CreateCommentDto) {
    const entityType = this.assertEntityType(dto.entityType);
    const entity = await this.assertEntityAllowed(user, entityType, dto.entityId);
    const siteId = dto.siteId ?? user.siteId ?? null;
    if (siteId) await this.assertSiteAllowed(user, siteId);
    if (siteId && entity.site_id && entity.site_id !== siteId) throw new BadRequestException('ENTITY_SITE_MISMATCH');

    if (dto.parentCommentId) {
      const parent = await this.findOneRaw(user.tenantId, dto.parentCommentId);
      if (!parent || parent.deleted_at) throw new NotFoundException('COMMENT_NOT_FOUND');
      if (parent.entity_type !== entityType || parent.entity_id !== dto.entityId) {
        throw new BadRequestException('COMMENT_THREAD_MISMATCH');
      }
    }

    const workstation = dto.workstationId ? await this.findWorkstation(user.tenantId, dto.workstationId) : null;
    const sanitizedCommentText = this.sanitizeCommentText(dto.commentText);
    const inserted = await this.db.query<{ comment_id: string }>(
      `
      INSERT INTO entity_comments (
        tenant_id, site_id, entity_type, entity_id, parent_comment_id, author_id,
        comment_text, visibility_scope, cash_session_id, workstation_id, workstation_name
      )
      VALUES ($1,$2,upper($3),$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING comment_id
      `,
      [
        user.tenantId,
        siteId,
        entityType,
        dto.entityId,
        dto.parentCommentId ?? null,
        user.userId,
        sanitizedCommentText,
        dto.visibilityScope ?? 'PUBLIC',
        dto.cashSessionId ?? null,
        dto.workstationId ?? null,
        workstation?.workstation_name ?? null,
      ],
    );
    await this.insertAudit(user, inserted.rows[0].comment_id, 'INSERT', dto, siteId, dto.cashSessionId ?? null, dto.workstationId ?? null, workstation?.workstation_name ?? null);
    return this.findOne(user, inserted.rows[0].comment_id);
  }

  async update(user: AuthUser, commentId: string, dto: UpdateCommentDto) {
    const current = await this.findOneRaw(user.tenantId, commentId);
    if (!current || current.deleted_at) throw new NotFoundException('COMMENT_NOT_FOUND');
    if (!this.canMutate(user, current.author_id)) throw new ForbiddenException('PERMISSION_DENIED');

    await this.db.query(
      `
      UPDATE entity_comments
      SET comment_text = COALESCE($3, comment_text),
          visibility_scope = COALESCE($4, visibility_scope),
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1 AND comment_id = $2
      `,
      [user.tenantId, commentId, dto.commentText === undefined ? null : this.sanitizeCommentText(dto.commentText), dto.visibilityScope ?? null],
    );
    await this.insertAudit(user, commentId, 'UPDATE', dto, current.site_id, current.cash_session_id, current.workstation_id, current.workstation_name);
    return this.findOne(user, commentId);
  }

  async remove(user: AuthUser, commentId: string) {
    const current = await this.findOneRaw(user.tenantId, commentId);
    if (!current || current.deleted_at) throw new NotFoundException('COMMENT_NOT_FOUND');
    if (!this.canMutate(user, current.author_id)) throw new ForbiddenException('PERMISSION_DENIED');

    await this.db.query(
      `UPDATE entity_comments SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND comment_id = $2`,
      [user.tenantId, commentId],
    );
    await this.insertAudit(user, commentId, 'DELETE', { deleted: true }, current.site_id, current.cash_session_id, current.workstation_id, current.workstation_name);
    return { deleted: true };
  }

  async findOne(user: AuthUser, commentId: string) {
    const row = await this.findOneRaw(user.tenantId, commentId);
    if (!row || row.deleted_at) return null;
    if (row.visibility_scope === 'PRIVATE' && row.author_id !== user.userId && !this.canReadPrivate(user)) return null;
    if (user.siteId && row.site_id && row.site_id !== user.siteId) return null;
    return this.toComment(row);
  }

  private async findOneRaw(tenantId: string, commentId: string) {
    const result = await this.db.query<CommentRow>(
      `
      SELECT ec.comment_id, ec.tenant_id, ec.site_id, s.site_name, ec.entity_type, ec.entity_id,
             ec.parent_comment_id, ec.author_id, u.full_name AS author_name, ec.comment_text,
             ec.visibility_scope, ec.cash_session_id, ec.workstation_id, ec.workstation_name,
             ec.created_at, ec.updated_at, ec.deleted_at
      FROM entity_comments ec
      LEFT JOIN users u ON u.user_id = ec.author_id AND u.tenant_id = ec.tenant_id
      LEFT JOIN sites s ON s.site_id = ec.site_id AND s.tenant_id = ec.tenant_id
      WHERE ec.tenant_id = $1 AND ec.comment_id = $2
      LIMIT 1
      `,
      [tenantId, commentId],
    );
    return result.rows[0] ?? null;
  }

  private async findWorkstation(tenantId: string, workstationId: string) {
    const result = await this.db.query<{ workstation_id: string; workstation_name: string }>(
      `SELECT workstation_id, workstation_name FROM pos_workstations WHERE tenant_id = $1 AND workstation_id = $2 LIMIT 1`,
      [tenantId, workstationId],
    );
    if (!result.rows[0]) throw new BadRequestException('WORKSTATION_NOT_FOUND');
    return result.rows[0];
  }

  private async assertSiteAllowed(user: AuthUser, siteId: string) {
    if (user.siteId && user.siteId !== siteId) throw new BadRequestException('SITE_NOT_ALLOWED');
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sites WHERE tenant_id = $1 AND site_id = $2`,
      [user.tenantId, siteId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new BadRequestException('SITE_NOT_IN_TENANT');
  }

  private assertEntityType(entityType: string): AllowedCommentEntityType {
    const normalized = String(entityType ?? '').trim().toUpperCase() as AllowedCommentEntityType;
    if (!Object.prototype.hasOwnProperty.call(COMMENT_ENTITY_MAP, normalized)) {
      throw new BadRequestException('COMMENT_ENTITY_TYPE_INVALID');
    }
    return normalized;
  }

  private async assertEntityAllowed(user: AuthUser, entityType: AllowedCommentEntityType, entityId: string) {
    const config = COMMENT_ENTITY_MAP[entityType];
    const result = await this.db.query<{ site_id: string | null }>(
      `
      SELECT ${config.siteColumn} AS site_id
      FROM ${config.tableName}
      WHERE tenant_id = $1
        AND ${config.idColumn} = $2::uuid
        AND ($3::uuid IS NULL OR ${config.siteColumn} = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, entityId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new NotFoundException('COMMENT_ENTITY_NOT_FOUND');
    return result.rows[0];
  }

  private sanitizeCommentText(raw: string) {
    const normalized = String(raw ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/<[^>]*>/g, '')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) throw new BadRequestException('COMMENT_TEXT_EMPTY');
    if (normalized.length > COMMENT_TEXT_MAX_LENGTH) throw new BadRequestException('COMMENT_TEXT_TOO_LONG');
    return normalized;
  }

  private canReadPrivate(user: AuthUser) {
    return ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(user.role) || user.permissions.includes('comments.delete');
  }

  private canMutate(user: AuthUser, authorId: string) {
    return authorId === user.userId || user.permissions.includes('comments.delete') || ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(user.role);
  }

  private async insertAudit(
    user: AuthUser,
    recordId: string,
    actionType: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: unknown,
    siteId: string | null,
    cashSessionId: string | null,
    workstationId: string | null,
    workstationName: string | null,
  ) {
    await this.db.query(
      `
      INSERT INTO audit_logs (
        tenant_id, site_id, user_id, table_name, record_id, action_type, new_value, cash_session_id, workstation_id, workstation_name
      )
      VALUES ($1,$2,$3,'entity_comments',$4,$5,$6::jsonb,$7,$8,$9)
      `,
      [user.tenantId, siteId, user.userId, recordId, actionType, JSON.stringify(payload), cashSessionId, workstationId, workstationName],
    );
  }

  private toComment(row: CommentRow) {
    return {
      commentId: row.comment_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      siteName: row.site_name,
      entityType: row.entity_type,
      entityId: row.entity_id,
      parentCommentId: row.parent_comment_id,
      authorId: row.author_id,
      authorName: row.author_name,
      commentText: row.comment_text,
      visibilityScope: row.visibility_scope,
      cashSessionId: row.cash_session_id,
      workstationId: row.workstation_id,
      workstationName: row.workstation_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
