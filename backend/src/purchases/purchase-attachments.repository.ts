import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type AttachmentScope = 'PURCHASE' | 'PURCHASE_RETURN' | 'CUSTOMER_RETURN';

type AttachmentRow = {
  purchase_attachment_id: string;
  tenant_id: string;
  site_id: string | null;
  purchase_id: string | null;
  purchase_return_id: string | null;
  customer_return_id: string | null;
  attachment_scope: AttachmentScope;
  attachment_type: string;
  file_name: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: string;
  description: string | null;
  uploaded_by: string | null;
  uploaded_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class PurchaseAttachmentsRepository {
  private readonly bucket = 'purchase-attachments';

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async findByPurchase(user: AuthUser, purchaseId: string) {
    await this.assertPurchase(user, purchaseId);
    return this.findAttachments(user, 'PURCHASE', purchaseId);
  }

  async findByReturn(user: AuthUser, purchaseReturnId: string) {
    await this.assertPurchaseReturn(user, purchaseReturnId);
    return this.findAttachments(user, 'PURCHASE_RETURN', purchaseReturnId);
  }

  async findByCustomerReturn(user: AuthUser, customerReturnId: string) {
    await this.assertCustomerReturn(user, customerReturnId);
    return this.findAttachments(user, 'CUSTOMER_RETURN', customerReturnId);
  }

  async uploadForPurchase(
    user: AuthUser,
    purchaseId: string,
    file: any,
    dto: { attachmentType?: string; description?: string },
  ) {
    const purchase = await this.assertPurchase(user, purchaseId);
    this.assertFile(file);
    const objectName = `${randomUUID()}-${this.safeFileName(file.originalname)}`;
    const storagePath = `tenant/${user.tenantId}/site/${purchase.site_id}/purchases/${purchaseId}/${objectName}`;
    await this.uploadObject(storagePath, file.buffer, file.mimetype);
    const inserted = await this.db.query<AttachmentRow>(
      `
      INSERT INTO purchase_attachments (
        tenant_id, site_id, purchase_id, attachment_scope, attachment_type,
        file_name, original_file_name, storage_bucket, storage_path, mime_type,
        file_size, description, uploaded_by
      )
      VALUES ($1,$2,$3,'PURCHASE',$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING purchase_attachment_id, tenant_id, site_id, purchase_id, purchase_return_id,
                attachment_scope, attachment_type, file_name, original_file_name, storage_bucket,
                storage_path, mime_type, file_size, description, uploaded_by, uploaded_at,
                deleted_at, deleted_by
      `,
      [
        user.tenantId,
        purchase.site_id,
        purchaseId,
        dto.attachmentType ?? 'OTHER',
        objectName,
        file.originalname,
        this.bucket,
        storagePath,
        file.mimetype,
        file.size,
        dto.description?.trim() || null,
        user.userId,
      ],
    );
    await this.insertAudit(user, inserted.rows[0].purchase_attachment_id, 'INSERT', {
      attachmentScope: 'PURCHASE',
      purchaseId,
      attachmentType: dto.attachmentType ?? 'OTHER',
      originalFileName: file.originalname,
      size: file.size,
    });
    return this.toAttachment(inserted.rows[0]);
  }

  async uploadForReturn(
    user: AuthUser,
    purchaseReturnId: string,
    file: any,
    dto: { attachmentType?: string; description?: string },
  ) {
    const purchaseReturn = await this.assertPurchaseReturn(user, purchaseReturnId);
    this.assertFile(file);
    const objectName = `${randomUUID()}-${this.safeFileName(file.originalname)}`;
    const storagePath = `tenant/${user.tenantId}/site/${purchaseReturn.site_id}/purchases/${purchaseReturn.purchase_id}/returns/${purchaseReturnId}/${objectName}`;
    await this.uploadObject(storagePath, file.buffer, file.mimetype);
    const inserted = await this.db.query<AttachmentRow>(
      `
      INSERT INTO purchase_attachments (
        tenant_id, site_id, purchase_id, purchase_return_id, attachment_scope, attachment_type,
        file_name, original_file_name, storage_bucket, storage_path, mime_type,
        file_size, description, uploaded_by
      )
      VALUES ($1,$2,$3,$4,'PURCHASE_RETURN',$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING purchase_attachment_id, tenant_id, site_id, purchase_id, purchase_return_id,
                attachment_scope, attachment_type, file_name, original_file_name, storage_bucket,
                storage_path, mime_type, file_size, description, uploaded_by, uploaded_at,
                deleted_at, deleted_by
      `,
      [
        user.tenantId,
        purchaseReturn.site_id,
        purchaseReturn.purchase_id,
        purchaseReturnId,
        dto.attachmentType ?? 'OTHER',
        objectName,
        file.originalname,
        this.bucket,
        storagePath,
        file.mimetype,
        file.size,
        dto.description?.trim() || null,
        user.userId,
      ],
    );
    await this.insertAudit(user, inserted.rows[0].purchase_attachment_id, 'INSERT', {
      attachmentScope: 'PURCHASE_RETURN',
      purchaseReturnId,
      attachmentType: dto.attachmentType ?? 'OTHER',
      originalFileName: file.originalname,
      size: file.size,
    });
    return this.toAttachment(inserted.rows[0]);
  }

  async uploadForCustomerReturn(
    user: AuthUser,
    customerReturnId: string,
    file: any,
    dto: { attachmentType?: string; description?: string },
  ) {
    const customerReturn = await this.assertCustomerReturn(user, customerReturnId);
    this.assertFile(file);
    const objectName = `${randomUUID()}-${this.safeFileName(file.originalname)}`;
    const storagePath = `tenant/${user.tenantId}/site/${customerReturn.site_id}/sales/${customerReturn.sale_id}/customer-returns/${customerReturnId}/${objectName}`;
    await this.uploadObject(storagePath, file.buffer, file.mimetype);
    const inserted = await this.db.query<AttachmentRow>(
      `
      INSERT INTO purchase_attachments (
        tenant_id, site_id, purchase_return_id, customer_return_id, attachment_scope, attachment_type,
        file_name, original_file_name, storage_bucket, storage_path, mime_type,
        file_size, description, uploaded_by
      )
      VALUES ($1,$2,NULL,$3,'CUSTOMER_RETURN',$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING purchase_attachment_id, tenant_id, site_id, purchase_id, purchase_return_id, customer_return_id,
                attachment_scope, attachment_type, file_name, original_file_name, storage_bucket,
                storage_path, mime_type, file_size, description, uploaded_by, uploaded_at,
                deleted_at, deleted_by
      `,
      [
        user.tenantId,
        customerReturn.site_id,
        customerReturnId,
        dto.attachmentType ?? 'OTHER',
        objectName,
        file.originalname,
        this.bucket,
        storagePath,
        file.mimetype,
        file.size,
        dto.description?.trim() || null,
        user.userId,
      ],
    );
    await this.insertAudit(user, inserted.rows[0].purchase_attachment_id, 'INSERT', {
      attachmentScope: 'CUSTOMER_RETURN',
      customerReturnId,
      attachmentType: dto.attachmentType ?? 'OTHER',
      originalFileName: file.originalname,
      size: file.size,
    });
    return this.toAttachment(inserted.rows[0]);
  }

  async createSignedUrlForPurchase(user: AuthUser, purchaseId: string, attachmentId: string) {
    await this.assertPurchase(user, purchaseId);
    const attachment = await this.findOne(user, attachmentId, 'PURCHASE', purchaseId);
    if (!attachment) return null;
    return { ...attachment, signedUrl: await this.createSignedUrl(attachment.storagePath) };
  }

  async createSignedUrlForReturn(user: AuthUser, purchaseReturnId: string, attachmentId: string) {
    await this.assertPurchaseReturn(user, purchaseReturnId);
    const attachment = await this.findOne(user, attachmentId, 'PURCHASE_RETURN', purchaseReturnId);
    if (!attachment) return null;
    return { ...attachment, signedUrl: await this.createSignedUrl(attachment.storagePath) };
  }

  async createSignedUrlForCustomerReturn(user: AuthUser, customerReturnId: string, attachmentId: string) {
    await this.assertCustomerReturn(user, customerReturnId);
    const attachment = await this.findOne(user, attachmentId, 'CUSTOMER_RETURN', customerReturnId);
    if (!attachment) return null;
    return { ...attachment, signedUrl: await this.createSignedUrl(attachment.storagePath) };
  }

  async removeForPurchase(user: AuthUser, purchaseId: string, attachmentId: string) {
    await this.assertPurchase(user, purchaseId);
    const attachment = await this.findOne(user, attachmentId, 'PURCHASE', purchaseId);
    if (!attachment) return null;
    await this.softDelete(user, attachmentId);
    return { deleted: true };
  }

  async removeForReturn(user: AuthUser, purchaseReturnId: string, attachmentId: string) {
    await this.assertPurchaseReturn(user, purchaseReturnId);
    const attachment = await this.findOne(user, attachmentId, 'PURCHASE_RETURN', purchaseReturnId);
    if (!attachment) return null;
    await this.softDelete(user, attachmentId);
    return { deleted: true };
  }

  async removeForCustomerReturn(user: AuthUser, customerReturnId: string, attachmentId: string) {
    await this.assertCustomerReturn(user, customerReturnId);
    const attachment = await this.findOne(user, attachmentId, 'CUSTOMER_RETURN', customerReturnId);
    if (!attachment) return null;
    await this.softDelete(user, attachmentId);
    return { deleted: true };
  }

  private async findAttachments(user: AuthUser, scope: AttachmentScope, entityId: string) {
    const idColumn = scope === 'PURCHASE' ? 'purchase_id' : scope === 'PURCHASE_RETURN' ? 'purchase_return_id' : 'customer_return_id';
    const result = await this.db.query<AttachmentRow>(
      `
      SELECT purchase_attachment_id, tenant_id, site_id, purchase_id, purchase_return_id,
             customer_return_id, attachment_scope, attachment_type, file_name, original_file_name, storage_bucket,
             storage_path, mime_type, file_size, description, uploaded_by, uploaded_at,
             deleted_at, deleted_by
      FROM purchase_attachments
      WHERE tenant_id = $1
        AND ${idColumn} = $2::uuid
        AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR site_id IS NULL OR site_id = $3::uuid)
      ORDER BY uploaded_at DESC, purchase_attachment_id DESC
      `,
      [user.tenantId, entityId, user.siteId ?? null],
    );
    return result.rows.map((row) => this.toAttachment(row));
  }

  private async findOne(user: AuthUser, attachmentId: string, scope: AttachmentScope, entityId: string) {
    const idColumn = scope === 'PURCHASE' ? 'purchase_id' : scope === 'PURCHASE_RETURN' ? 'purchase_return_id' : 'customer_return_id';
    const result = await this.db.query<AttachmentRow>(
      `
      SELECT purchase_attachment_id, tenant_id, site_id, purchase_id, purchase_return_id,
             customer_return_id, attachment_scope, attachment_type, file_name, original_file_name, storage_bucket,
             storage_path, mime_type, file_size, description, uploaded_by, uploaded_at,
             deleted_at, deleted_by
      FROM purchase_attachments
      WHERE tenant_id = $1
        AND purchase_attachment_id = $2::uuid
        AND ${idColumn} = $3::uuid
        AND deleted_at IS NULL
        AND ($4::uuid IS NULL OR site_id IS NULL OR site_id = $4::uuid)
      LIMIT 1
      `,
      [user.tenantId, attachmentId, entityId, user.siteId ?? null],
    );
    return result.rows[0] ? this.toAttachment(result.rows[0]) : null;
  }

  private async softDelete(user: AuthUser, attachmentId: string) {
    await this.db.query(
      `
      UPDATE purchase_attachments
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $3
      WHERE tenant_id = $1
        AND purchase_attachment_id = $2::uuid
      `,
      [user.tenantId, attachmentId, user.userId],
    );
    await this.insertAudit(user, attachmentId, 'DELETE', { deleted: true });
  }

  private async assertPurchase(user: AuthUser, purchaseId: string) {
    const result = await this.db.query<{ purchase_id: string; site_id: string; status: string }>(
      `
      SELECT purchase_id, site_id, status
      FROM purchases
      WHERE tenant_id = $1
        AND purchase_id = $2::uuid
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, purchaseId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_NOT_FOUND');
    return result.rows[0];
  }

  private async assertPurchaseReturn(user: AuthUser, purchaseReturnId: string) {
    const result = await this.db.query<{ purchase_return_id: string; purchase_id: string; site_id: string; status: string }>(
      `
      SELECT purchase_return_id, purchase_id, site_id, status
      FROM purchase_returns
      WHERE tenant_id = $1
        AND purchase_return_id = $2::uuid
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, purchaseReturnId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('PURCHASE_RETURN_NOT_FOUND');
    return result.rows[0];
  }

  private async assertCustomerReturn(user: AuthUser, customerReturnId: string) {
    const result = await this.db.query<{ customer_return_id: string; sale_id: string; site_id: string; status: string }>(
      `
      SELECT customer_return_id, sale_id, site_id, status
      FROM customer_returns
      WHERE tenant_id = $1
        AND customer_return_id = $2::uuid
        AND ($3::uuid IS NULL OR site_id = $3::uuid)
      LIMIT 1
      `,
      [user.tenantId, customerReturnId, user.siteId ?? null],
    );
    if (!result.rows[0]) throw new Error('CUSTOMER_RETURN_NOT_FOUND');
    return result.rows[0];
  }

  private assertFile(file: any) {
    if (!file?.buffer || !file.originalname || !file.mimetype) throw new Error('ATTACHMENT_FILE_REQUIRED');
    if (Number(file.size ?? 0) <= 0) throw new Error('ATTACHMENT_FILE_REQUIRED');
    if (Number(file.size) > MAX_FILE_SIZE) throw new Error('ATTACHMENT_FILE_TOO_LARGE');
    if (!ALLOWED_MIME_TYPES.has(String(file.mimetype).toLowerCase())) throw new Error('ATTACHMENT_TYPE_NOT_ALLOWED');
  }

  private safeFileName(name: string) {
    return String(name ?? 'file')
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 180) || 'file';
  }

  private async uploadObject(storagePath: string, buffer: Buffer, mimeType: string) {
    const url = this.requireSupabaseUrl();
    const key = this.requireServiceRoleKey();
    const response = await fetch(`${url}/storage/v1/object/${this.bucket}/${storagePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(buffer),
    });
    if (response.ok) return;
    const text = await response.text();
    if (response.status === 409) throw new Error('ATTACHMENT_ALREADY_EXISTS');
    throw new Error(`ATTACHMENT_UPLOAD_FAILED:${response.status}:${text}`);
  }

  private async createSignedUrl(storagePath: string) {
    const url = this.requireSupabaseUrl();
    const key = this.requireServiceRoleKey();
    const response = await fetch(`${url}/storage/v1/object/sign/${this.bucket}/${storagePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ATTACHMENT_SIGN_URL_FAILED:${response.status}:${text}`);
    }
    const body = await response.json() as { signedURL?: string };
    if (!body.signedURL) throw new Error('ATTACHMENT_SIGN_URL_FAILED');
    return body.signedURL.startsWith('http') ? body.signedURL : `${url}/storage/v1${body.signedURL}`;
  }

  private requireSupabaseUrl() {
    const value = this.config.get<string>('SUPABASE_URL')?.trim();
    if (!value) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
    return value.replace(/\/+$/, '');
  }

  private requireServiceRoleKey() {
    const value = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    if (!value) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
    return value;
  }

  private async insertAudit(user: AuthUser, attachmentId: string, actionType: 'INSERT' | 'DELETE', payload: unknown) {
    await this.db.query(
      `
      INSERT INTO audit_logs (tenant_id, site_id, user_id, table_name, record_id, action_type, new_value)
      VALUES ($1,$2,$3,'purchase_attachments',$4,$5,$6::jsonb)
      `,
      [user.tenantId, user.siteId ?? null, user.userId, attachmentId, actionType, JSON.stringify(payload)],
    );
  }

  private toAttachment(row: AttachmentRow) {
    return {
      purchaseAttachmentId: row.purchase_attachment_id,
      tenantId: row.tenant_id,
      siteId: row.site_id,
      purchaseId: row.purchase_id,
      purchaseReturnId: row.purchase_return_id,
      customerReturnId: row.customer_return_id,
      attachmentScope: row.attachment_scope,
      attachmentType: row.attachment_type,
      fileName: row.file_name,
      originalFileName: row.original_file_name,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size),
      description: row.description,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
    };
  }
}
