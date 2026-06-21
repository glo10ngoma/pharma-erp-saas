import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateGalenicFormDto } from './dto/create-galenic-form.dto';
import { UpdateGalenicFormDto } from './dto/update-galenic-form.dto';
import { GalenicFormsRepository } from './galenic-forms.repository';

@Injectable()
export class GalenicFormsService {
  constructor(private readonly repository: GalenicFormsRepository) {}
  findAll(user: AuthUser) { return this.repository.findAll(user); }
  async findOne(user: AuthUser, id: string) { const found = await this.repository.findOne(user, id); if (!found) throw new NotFoundException('GALENIC_FORM_NOT_FOUND'); return found; }
  create(user: AuthUser, dto: CreateGalenicFormDto) { return this.repository.create(user, dto); }
  async update(user: AuthUser, id: string, dto: UpdateGalenicFormDto) { const updated = await this.repository.update(user, id, dto); if (!updated) throw new NotFoundException('GALENIC_FORM_NOT_FOUND'); return updated; }
  async remove(user: AuthUser, id: string) { const removed = await this.repository.remove(user, id); if (!removed) throw new NotFoundException('GALENIC_FORM_NOT_FOUND'); return removed; }
}
