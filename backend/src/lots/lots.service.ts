import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ConfirmFefoActionDto } from './dto/confirm-fefo-action.dto';
import { RemoveExpiredStockDto } from './dto/remove-expired-stock.dto';
import { LotsRepository } from './lots.repository';

@Injectable()
export class LotsService {
  constructor(private readonly repository: LotsRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findFefoActions(user: AuthUser, siteId?: string) { return this.repository.findFefoActions(user, siteId); }
  async findOne(user: AuthUser, id: string) { const lot = await this.repository.findOne(user, id); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
  async block(user: AuthUser, id: string, reason?: string) { const lot = await this.repository.block(user, id, reason); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
  async unblock(user: AuthUser, id: string) { const lot = await this.repository.unblock(user, id); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
  confirmFefoAction(user: AuthUser, id: string, dto: ConfirmFefoActionDto) { return this.repository.confirmFefoAction(user, id, dto); }
  removeExpiredStock(user: AuthUser, id: string, dto: RemoveExpiredStockDto) { return this.repository.removeExpiredStock(user, id, dto); }
}
