import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
import { PosSyncRepository } from './pos-sync.repository';

@Injectable()
export class PosSyncService {
  constructor(private readonly repository: PosSyncRepository) {}

  ping() {
    return {
      status: 'OK',
      serverTime: new Date().toISOString(),
      appVersion: process.env.APP_VERSION ?? '0.1.0',
    };
  }

  registerWorkstation(user: AuthUser, dto: RegisterPosWorkstationDto) {
    return this.repository.registerWorkstation(user, dto);
  }

  bootstrap(user: AuthUser, query: BootstrapPosDto) {
    return this.repository.buildBootstrap(user, query);
  }

  changes(user: AuthUser, query: ListPosChangesDto) {
    return this.repository.listChanges(user, query);
  }
}

