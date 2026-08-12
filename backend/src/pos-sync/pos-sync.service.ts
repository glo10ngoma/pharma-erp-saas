import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { SalesService } from '../sales/sales.service';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { HeartbeatPosDto } from './dto/heartbeat-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { ListPosSyncAdminDto } from './dto/list-pos-sync-admin.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
import { ResolvePosSyncConflictDto } from './dto/resolve-pos-sync-conflict.dto';
import { SubmitPosOperationsDto } from './dto/submit-pos-operations.dto';
import { PosSyncRepository } from './pos-sync.repository';

@Injectable()
export class PosSyncService {
  constructor(
    private readonly repository: PosSyncRepository,
    private readonly salesService: SalesService,
  ) {}

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

  heartbeat(user: AuthUser, dto: HeartbeatPosDto) {
    return this.repository.heartbeat(user, dto);
  }

  adminDashboard(user: AuthUser, query: ListPosSyncAdminDto) {
    return this.repository.adminDashboard(user, query);
  }

  adminWorkstations(user: AuthUser, query: ListPosSyncAdminDto) {
    return this.repository.adminWorkstations(user, query);
  }

  adminWorkstation(user: AuthUser, id: string) {
    return this.repository.adminWorkstation(user, id);
  }

  revokeWorkstation(user: AuthUser, id: string) {
    return this.repository.revokeWorkstation(user, id);
  }

  adminConflicts(user: AuthUser, query: ListPosSyncAdminDto) {
    return this.repository.adminConflicts(user, query);
  }

  adminConflict(user: AuthUser, id: string) {
    return this.repository.adminConflict(user, id);
  }

  resolveConflict(user: AuthUser, id: string, dto: ResolvePosSyncConflictDto) {
    return this.repository.resolveConflict(user, id, dto);
  }

  adminLogs(user: AuthUser, query: ListPosSyncAdminDto) {
    return this.repository.adminLogs(user, query);
  }

  async pushOperations(user: AuthUser, dto: SubmitPosOperationsDto) {
    const results = [];
    for (const operation of dto.operations) {
      if (operation.operationType !== 'SALE_VALIDATE') {
        results.push({
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          status: 'CONFLICT',
          errorCode: 'OPERATION_NOT_SUPPORTED',
          message: 'Operation offline non supportee',
        });
        continue;
      }

      try {
        await this.repository.ensureWorkstationOperational(user, {
          workstationId: operation.workstationId,
          deviceId: operation.deviceId,
        });
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : 'WORKSTATION_REVOKED';
        await this.repository.recordConflict(user, {
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          workstationId: operation.workstationId,
          siteId: operation.siteId,
          offlineReference: operation.offlineReference,
          conflictCode: errorCode,
          message: errorCode,
          localPayload: operation,
        });
        results.push({
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          status: 'CONFLICT',
          errorCode,
          message: errorCode,
        });
        continue;
      }

      const existing = await this.repository.findProcessedOperation(user, operation.operationId);
      if (existing) {
        const allocations = await this.repository.getOperationAllocationStates(user, operation);
        results.push({
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          status: 'ALREADY_PROCESSED',
          serverSaleId: existing.serverSaleId,
          serverSaleNumber: existing.serverSaleNumber,
          allocations,
        });
        continue;
      }

      try {
        const validated = await this.salesService.replayOfflineValidatedSale(user, operation);

        await this.repository.recordProcessedOperation(user, {
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          operationType: operation.operationType,
          payload: operation,
          serverSaleId: validated.saleId,
          serverSaleNumber: validated.saleNumber,
        });

        results.push({
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          status: 'SYNCED',
          serverSaleId: validated.saleId,
          serverSaleNumber: validated.saleNumber,
          allocations: validated.allocations,
        });
      } catch (error) {
        await this.repository.recordConflict(user, {
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          workstationId: operation.workstationId,
          siteId: operation.siteId,
          offlineReference: operation.offlineReference,
          conflictCode: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
          message: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
          localPayload: operation,
        });
        results.push({
          operationId: operation.operationId,
          localSaleId: operation.localSaleId,
          status: 'CONFLICT',
          errorCode: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
          message: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
        });
      }
    }

    return {
      serverTime: new Date().toISOString(),
      results,
    };
  }
}
