import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsRepository } from './organizations.repository';

@Injectable()
export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findOne(user: AuthUser, id: string) { return this.repository.findOne(user, id); }
  create(user: AuthUser, dto: CreateOrganizationDto) { return this.repository.create(user, dto); }
  update(user: AuthUser, id: string, dto: UpdateOrganizationDto) { return this.repository.update(user, id, dto); }
  disable(user: AuthUser, id: string) { return this.repository.disable(user, id); }
}
