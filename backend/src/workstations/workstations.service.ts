import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateWorkstationDto } from './dto/create-workstation.dto';
import { UpdateWorkstationDto } from './dto/update-workstation.dto';
import { WorkstationsRepository } from './workstations.repository';

@Injectable()
export class WorkstationsService {
  constructor(private readonly repository: WorkstationsRepository) {}

  findAll(user: AuthUser) {
    return this.repository.findAll(user);
  }

  async findOne(user: AuthUser, id: string) {
    const item = await this.repository.findOne(user, id);
    if (!item) throw new NotFoundException('WORKSTATION_NOT_FOUND');
    return item;
  }

  create(user: AuthUser, dto: CreateWorkstationDto) {
    return this.repository.create(user, dto);
  }

  update(user: AuthUser, id: string, dto: UpdateWorkstationDto) {
    return this.repository.update(user, id, dto);
  }
}
