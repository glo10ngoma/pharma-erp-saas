import { Injectable } from '@nestjs/common';
import { TransfersRepository } from './transfers.repository';

@Injectable()
export class TransfersService {
  constructor(private readonly repository: TransfersRepository) {}

  findAll() {
    return this.repository.findAll();
  }
}
