import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateInsurancePlanDto } from './dto/create-insurance-plan.dto';
import { UpdateInsurancePlanDto } from './dto/update-insurance-plan.dto';
import { InsurancePlansRepository } from './insurance-plans.repository';

@Injectable()
export class InsurancePlansService {
  constructor(private readonly repository: InsurancePlansRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findOne(user: AuthUser, id: string) { return this.repository.findOne(user, id); }
  create(user: AuthUser, dto: CreateInsurancePlanDto) { return this.repository.create(user, dto); }
  update(user: AuthUser, id: string, dto: UpdateInsurancePlanDto) { return this.repository.update(user, id, dto); }
}
