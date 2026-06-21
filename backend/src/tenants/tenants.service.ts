import { Injectable } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';

@Injectable()
export class TenantsService {
  constructor(private readonly repository: TenantsRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
