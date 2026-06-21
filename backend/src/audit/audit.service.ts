import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
