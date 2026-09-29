import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreatePriceCheckDto } from './dto/create-price-check.dto';
import { ListPriceChecksDto } from './dto/list-price-checks.dto';
import { PriceChecksRepository } from './price-checks.repository';

@Injectable()
export class PriceChecksService {
  constructor(private readonly repository: PriceChecksRepository) {}

  searchArticles(user: AuthUser, siteId: string, search?: string) {
    if (!siteId) throw new BadRequestException('SITE_REQUIRED');
    return this.repository.searchArticles(user, siteId, search ?? '');
  }

  list(user: AuthUser, query: ListPriceChecksDto) {
    return this.repository.list(user, query);
  }

  async findOne(user: AuthUser, id: string) {
    const current = await this.repository.findOne(user, id);
    if (!current) throw new NotFoundException('PRICE_CHECK_NOT_FOUND');
    return current;
  }

  create(user: AuthUser, dto: CreatePriceCheckDto) {
    if (!dto.items?.length) throw new BadRequestException('PRICE_CHECK_ITEMS_REQUIRED');
    return this.repository.create(user, dto);
  }
}
