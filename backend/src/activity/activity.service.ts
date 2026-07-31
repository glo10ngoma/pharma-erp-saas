import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ActivityRepository } from './activity.repository';

@Injectable()
export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  findRecent(user: AuthUser, limit?: number) {
    return this.repository.findRecent(user, limit);
  }
}
