import { Injectable } from '@nestjs/common';
import { DisposalsRepository } from './disposals.repository';

@Injectable()
export class DisposalsService {
  constructor(private readonly repository: DisposalsRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
