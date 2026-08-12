import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateOfflineAllocationDto } from './dto/create-offline-allocation.dto';
import { ListOfflineAllocationsDto } from './dto/list-offline-allocations.dto';
import { RebalanceOfflineAllocationsDto } from './dto/rebalance-offline-allocations.dto';
import { TransferOfflineAllocationDto } from './dto/transfer-offline-allocation.dto';
import { UpdateOfflineAllocationDto } from './dto/update-offline-allocation.dto';
import { OfflineAllocationsRepository } from './offline-allocations.repository';

@Injectable()
export class OfflineAllocationsService {
  constructor(private readonly repository: OfflineAllocationsRepository) {}

  list(user: AuthUser, query: ListOfflineAllocationsDto) {
    return this.repository.list(user, query);
  }

  findOne(user: AuthUser, id: string) {
    return this.repository.findOne(user, id);
  }

  create(user: AuthUser, dto: CreateOfflineAllocationDto) {
    return this.repository.create(user, dto);
  }

  update(user: AuthUser, id: string, dto: UpdateOfflineAllocationDto) {
    return this.repository.update(user, id, dto);
  }

  suspend(user: AuthUser, id: string) {
    return this.repository.suspend(user, id);
  }

  revoke(user: AuthUser, id: string) {
    return this.repository.revoke(user, id);
  }

  release(user: AuthUser, id: string) {
    return this.repository.release(user, id);
  }

  transfer(user: AuthUser, dto: TransferOfflineAllocationDto) {
    return this.repository.transfer(user, dto);
  }

  rebalance(user: AuthUser, dto: RebalanceOfflineAllocationsDto) {
    return this.repository.rebalance(user, dto);
  }
}
