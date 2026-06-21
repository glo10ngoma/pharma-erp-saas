import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipsRepository } from './memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(private readonly repository: MembershipsRepository) {}

  findAll(user: AuthUser) { return this.repository.findAll(user); }
  findOne(user: AuthUser, id: string) { return this.repository.findOne(user, id); }
  findByCustomer(user: AuthUser, customerId: string) { return this.repository.findByCustomer(user, customerId); }
  create(user: AuthUser, dto: CreateMembershipDto) { return this.repository.create(user, dto); }
}
