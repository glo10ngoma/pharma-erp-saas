import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const BUSINESS_ERRORS: Record<string, number> = {
  STOCK_INSUFFICIENT: HttpStatus.CONFLICT,
  LOT_EXPIRED: HttpStatus.CONFLICT,
  LOT_BLOCKED: HttpStatus.CONFLICT,
  PURCHASE_NOT_DRAFT: HttpStatus.CONFLICT,
  SALE_NOT_DRAFT: HttpStatus.CONFLICT,
  CASH_SESSION_ALREADY_OPEN: HttpStatus.CONFLICT,
  PAYMENT_INSUFFICIENT: HttpStatus.BAD_REQUEST,
  PERMISSION_DENIED: HttpStatus.FORBIDDEN,
  PURCHASE_HAS_NO_ITEMS: HttpStatus.BAD_REQUEST,
  SALE_HAS_NO_ITEMS: HttpStatus.BAD_REQUEST,
  INVALID_PURCHASE_QUANTITY: HttpStatus.BAD_REQUEST,
  INVALID_LOT_NUMBER: HttpStatus.BAD_REQUEST,
  INVALID_EXPIRY_DATE: HttpStatus.BAD_REQUEST,
  SITE_NOT_ALLOWED: HttpStatus.FORBIDDEN,
  SITE_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  SUPPLIER_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  ARTICLE_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  CUSTOMER_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  ROLE_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  CURRENCY_NOT_FOUND: HttpStatus.BAD_REQUEST,
  PAYMENT_METHOD_NOT_FOUND: HttpStatus.BAD_REQUEST,
  PURCHASE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SALE_NOT_FOUND: HttpStatus.NOT_FOUND,
  CASH_SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  CASH_SESSION_NOT_OPEN: HttpStatus.BAD_REQUEST,
  ORGANIZATION_NOT_IN_TENANT: HttpStatus.BAD_REQUEST,
  INSURANCE_PLAN_NOT_ACTIVE: HttpStatus.BAD_REQUEST,
  MEMBERSHIP_NOT_ACTIVE: HttpStatus.BAD_REQUEST,
  CUSTOMER_REQUIRED_FOR_INSURANCE: HttpStatus.BAD_REQUEST,
  RECEIVABLE_NOT_FOUND: HttpStatus.NOT_FOUND,
  RECEIVABLE_PAYMENT_TOO_HIGH: HttpStatus.BAD_REQUEST,
  INVENTORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVENTORY_NOT_DRAFT: HttpStatus.CONFLICT,
  INVENTORY_NOT_IN_PROGRESS: HttpStatus.CONFLICT,
  INVENTORY_NOT_CLOSED: HttpStatus.CONFLICT,
  INVENTORY_ALREADY_VALIDATED: HttpStatus.CONFLICT,
  INVENTORY_VALIDATED_LOCKED: HttpStatus.CONFLICT,
  INVENTORY_EMPTY: HttpStatus.BAD_REQUEST,
  INVENTORY_ITEM_NOT_COUNTED: HttpStatus.BAD_REQUEST,
  STOCK_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNTING_ENTRY_NOT_BALANCED: HttpStatus.BAD_REQUEST,
  ACCOUNTING_JOURNAL_NOT_FOUND: HttpStatus.BAD_REQUEST,
  ACCOUNTING_ACCOUNT_NOT_FOUND: HttpStatus.BAD_REQUEST,
};

@Catch(Error)
export class BusinessErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<Request & { url?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message = typeof payload === 'string' ? payload : (payload as { message?: unknown }).message;

      return response.status(status).json({
        statusCode: status,
        error: this.normalizeMessage(message),
        message: this.normalizeMessage(message),
        path: request.url,
      });
    }

    const status = BUSINESS_ERRORS[exception.message] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = status === HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : exception.message;

    return response.status(status).json({
      statusCode: status,
      error: message,
      message,
      path: request.url,
    });
  }

  private normalizeMessage(message: unknown) {
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
    return 'REQUEST_FAILED';
  }
}
