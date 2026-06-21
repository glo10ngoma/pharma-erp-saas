import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { AddInventoryItemDto } from './dto/add-inventory-item.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoriesRepository } from './inventories.repository';

@Injectable()
export class InventoriesService {
  constructor(private readonly repository: InventoriesRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }
  create(user: AuthUser, dto: CreateInventoryDto) { return this.repository.create(user, dto); }
  findOne(user: AuthUser, id: string) { return this.repository.findOne(user, id); }
  start(user: AuthUser, id: string) { return this.repository.start(user, id); }
  close(user: AuthUser, id: string) { return this.repository.close(user, id); }
  validate(user: AuthUser, id: string) { return this.repository.validate(user, id); }
  findItems(user: AuthUser, id: string) { return this.repository.findItems(user, id); }
  addItem(user: AuthUser, id: string, dto: AddInventoryItemDto) { return this.repository.addItem(user, id, dto); }
  updateItem(user: AuthUser, id: string, itemId: string, dto: UpdateInventoryItemDto) { return this.repository.updateItem(user, id, itemId, dto); }
}
