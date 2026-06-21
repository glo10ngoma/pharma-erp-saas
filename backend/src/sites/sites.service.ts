import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesRepository } from './sites.repository';

@Injectable()
export class SitesService {
  constructor(private readonly repository: SitesRepository) {}

  findAll(user: AuthUser) {
    return this.repository.findAll(user);
  }

  async findOne(user: AuthUser, siteId: string) {
    const site = await this.repository.findOne(user, siteId);
    if (!site) throw new NotFoundException('SITE_NOT_FOUND');
    return site;
  }

  create(user: AuthUser, dto: CreateSiteDto) {
    return this.repository.create(user, dto);
  }

  async update(user: AuthUser, siteId: string, dto: UpdateSiteDto) {
    const site = await this.repository.update(user, siteId, dto);
    if (!site) throw new NotFoundException('SITE_NOT_FOUND');
    return site;
  }

  async remove(user: AuthUser, siteId: string) {
    const site = await this.repository.remove(user, siteId);
    if (!site) throw new NotFoundException('SITE_NOT_FOUND');
    return site;
  }
}
