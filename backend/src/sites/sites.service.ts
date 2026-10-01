import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(user: AuthUser, dto: CreateSiteDto) {
    try {
      return await this.repository.create(user, dto);
    } catch (error) {
      if (error instanceof Error && error.message === 'SITE_NOT_ALLOWED') {
        throw new ForbiddenException('SITE_NOT_ALLOWED');
      }

      throw error;
    }
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
