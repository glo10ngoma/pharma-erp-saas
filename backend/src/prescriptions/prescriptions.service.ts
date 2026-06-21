import { Injectable } from '@nestjs/common';
import { PrescriptionsRepository } from './prescriptions.repository';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly repository: PrescriptionsRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
