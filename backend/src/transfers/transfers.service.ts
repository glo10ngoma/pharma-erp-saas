import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AddTransferItemDto } from './dto/add-transfer-item.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersRepository } from './transfers.repository';

@Injectable()
export class TransfersService {
  constructor(private readonly repository: TransfersRepository) {}

  findAll(user: AuthUser, status?: string) {
    return this.repository.findAll(user, status);
  }

  async findOne(user: AuthUser, id: string) {
    const transfer = await this.repository.findOne(user, id);
    if (!transfer) throw new NotFoundException('TRANSFER_NOT_FOUND');
    return transfer;
  }

  create(user: AuthUser, dto: CreateTransferDto) {
    return this.wrap(() => this.repository.create(user, dto));
  }

  async addItem(user: AuthUser, id: string, dto: AddTransferItemDto) {
    return this.wrap(async () => {
      const transfer = await this.repository.addItem(user, id, dto);
      if (!transfer) throw new NotFoundException('TRANSFER_NOT_FOUND');
      return transfer;
    });
  }

  async removeItem(user: AuthUser, id: string, itemId: string) {
    return this.wrap(async () => {
      const transfer = await this.repository.removeItem(user, id, itemId);
      if (!transfer) throw new NotFoundException('TRANSFER_NOT_FOUND');
      return transfer;
    });
  }

  async validate(user: AuthUser, id: string) {
    return this.wrap(async () => {
      const transfer = await this.repository.validate(user, id);
      if (!transfer) throw new NotFoundException('TRANSFER_NOT_FOUND');
      return transfer;
    });
  }

  private async wrap<T>(callback: () => Promise<T>) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof Error) {
        const bad = [
          'TRANSFER_NOT_DRAFT',
          'TRANSFER_EMPTY',
          'STOCK_INSUFFICIENT',
          'SITE_NOT_ALLOWED',
          'SITE_NOT_IN_TENANT',
          'ARTICLE_NOT_IN_TENANT',
          'LOT_NOT_IN_TENANT',
          'TRANSFER_SAME_SITE',
          'INVALID_TRANSFER_QUANTITY',
        ];
        if (bad.includes(error.message)) throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
