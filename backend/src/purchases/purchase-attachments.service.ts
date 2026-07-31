import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PurchaseAttachmentsRepository } from './purchase-attachments.repository';

@Injectable()
export class PurchaseAttachmentsService {
  constructor(private readonly repository: PurchaseAttachmentsRepository) {}

  findForPurchase(user: AuthUser, purchaseId: string) {
    return this.wrap(() => this.repository.findByPurchase(user, purchaseId));
  }

  uploadForPurchase(user: AuthUser, purchaseId: string, file: any, dto: { attachmentType?: string; description?: string }) {
    return this.wrap(() => this.repository.uploadForPurchase(user, purchaseId, file, dto));
  }

  signedUrlForPurchase(user: AuthUser, purchaseId: string, attachmentId: string) {
    return this.wrap(async () => {
      const found = await this.repository.createSignedUrlForPurchase(user, purchaseId, attachmentId);
      if (!found) throw new NotFoundException('PURCHASE_ATTACHMENT_NOT_FOUND');
      return found;
    });
  }

  removeForPurchase(user: AuthUser, purchaseId: string, attachmentId: string) {
    return this.wrap(async () => {
      const removed = await this.repository.removeForPurchase(user, purchaseId, attachmentId);
      if (!removed) throw new NotFoundException('PURCHASE_ATTACHMENT_NOT_FOUND');
      return removed;
    });
  }

  findForReturn(user: AuthUser, purchaseReturnId: string) {
    return this.wrap(() => this.repository.findByReturn(user, purchaseReturnId));
  }

  uploadForReturn(user: AuthUser, purchaseReturnId: string, file: any, dto: { attachmentType?: string; description?: string }) {
    return this.wrap(() => this.repository.uploadForReturn(user, purchaseReturnId, file, dto));
  }

  signedUrlForReturn(user: AuthUser, purchaseReturnId: string, attachmentId: string) {
    return this.wrap(async () => {
      const found = await this.repository.createSignedUrlForReturn(user, purchaseReturnId, attachmentId);
      if (!found) throw new NotFoundException('PURCHASE_ATTACHMENT_NOT_FOUND');
      return found;
    });
  }

  removeForReturn(user: AuthUser, purchaseReturnId: string, attachmentId: string) {
    return this.wrap(async () => {
      const removed = await this.repository.removeForReturn(user, purchaseReturnId, attachmentId);
      if (!removed) throw new NotFoundException('PURCHASE_ATTACHMENT_NOT_FOUND');
      return removed;
    });
  }

  private async wrap<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        const bad = [
          'PURCHASE_NOT_FOUND',
          'PURCHASE_RETURN_NOT_FOUND',
          'ATTACHMENT_FILE_REQUIRED',
          'ATTACHMENT_FILE_TOO_LARGE',
          'ATTACHMENT_TYPE_NOT_ALLOWED',
          'ATTACHMENT_ALREADY_EXISTS',
          'SUPABASE_STORAGE_NOT_CONFIGURED',
        ];
        if (bad.includes(error.message) || error.message.startsWith('ATTACHMENT_UPLOAD_FAILED') || error.message.startsWith('ATTACHMENT_SIGN_URL_FAILED')) {
          throw new BadRequestException(error.message);
        }
        if (error.message === 'PERMISSION_DENIED') throw new ForbiddenException('PERMISSION_DENIED');
      }
      throw error;
    }
  }
}
