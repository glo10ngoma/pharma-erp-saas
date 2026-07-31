import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ATTACHMENT_TYPES = [
  'INVOICE',
  'DELIVERY_NOTE',
  'RECEIPT',
  'PAYMENT_PROOF',
  'PRODUCT_PHOTO',
  'CUSTOMS_DOCUMENT',
  'RETURN_NOTE',
  'CREDIT_NOTE',
  'OTHER',
] as const;

export class UploadPurchaseAttachmentDto {
  @IsOptional()
  @IsString()
  @IsIn(ATTACHMENT_TYPES)
  attachmentType?: (typeof ATTACHMENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
