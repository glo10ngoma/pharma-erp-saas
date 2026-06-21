import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateAdministrationRouteDto } from './dto/create-administration-route.dto';
import { UpdateAdministrationRouteDto } from './dto/update-administration-route.dto';
import { AdministrationRoutesRepository } from './administration-routes.repository';

@Injectable()
export class AdministrationRoutesService {
  constructor(private readonly repository: AdministrationRoutesRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('ADMINISTRATION_ROUTE_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreateAdministrationRouteDto) { return this.repository.create(user, dto); }
  async update(user: AuthUser, id: string, dto: UpdateAdministrationRouteDto) { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('ADMINISTRATION_ROUTE_NOT_FOUND'); return updated; }
  async remove(user: AuthUser, id: string) { const removed = await this.repository.remove(user, id); if (!removed) throw new NotFoundException('ADMINISTRATION_ROUTE_NOT_FOUND'); return removed; }
}
