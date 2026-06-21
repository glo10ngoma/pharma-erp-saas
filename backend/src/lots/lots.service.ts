import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { LotsRepository } from './lots.repository';

@Injectable()
export class LotsService {
  constructor(private readonly repository: LotsRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const lot = await this.repository.findOne(user, id); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
  async block(user: AuthUser, id: string, reason?: string) { const lot = await this.repository.block(user, id, reason); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
  async unblock(user: AuthUser, id: string) { const lot = await this.repository.unblock(user, id); if (!lot) throw new NotFoundException('LOT_NOT_FOUND'); return lot; }
}
