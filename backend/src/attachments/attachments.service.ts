import { Injectable } from '@nestjs/common';
import { AttachmentsRepository } from './attachments.repository';

@Injectable()
export class AttachmentsService {
  constructor(private readonly repository: AttachmentsRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
