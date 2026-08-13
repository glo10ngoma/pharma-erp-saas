import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CashService } from '../cash/cash.service';
import { SalesService } from '../sales/sales.service';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { HeartbeatPosDto } from './dto/heartbeat-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { ListPosSyncAdminDto } from './dto/list-pos-sync-admin.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
import { ResolvePosSyncConflictDto } from './dto/resolve-pos-sync-conflict.dto';
import {
  SubmitPosCashExpenseOperation,
  SubmitPosCashSessionCloseOperation,
  SubmitPosCashSessionOpenOperation,
  SubmitPosOperation,
  SubmitPosOperationsDto,
} from './dto/submit-pos-operations.dto';
import { PosSyncRepository } from './pos-sync.repository';

@Injectable()
export class PosSyncService {
  constructor(
    private readonly repository: PosSyncRepository,
    private readonly salesService: SalesService,
    private readonly cashService: CashService,
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
      try {
        await this.repository.ensureWorkstationOperational(user, {
          workstationId: operation.workstationId,
          deviceId: operation.deviceId,
        });
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : 'WORKSTATION_REVOKED';
        await this.repository.recordConflict(user, {
          operationId: operation.operationId,
          localSaleId: this.getOperationLocalEntityId(operation),
          workstationId: operation.workstationId,
          siteId: operation.siteId,
          offlineReference: this.getOperationReference(operation),
          conflictCode: errorCode,
          message: errorCode,
          localPayload: operation,
        });
        results.push({
          operationId: operation.operationId,
          localSaleId: 'localSaleId' in operation ? operation.localSaleId : null,
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
          localSaleId: 'localSaleId' in operation ? operation.localSaleId : null,
          status: 'ALREADY_PROCESSED',
          serverSaleId: existing.serverSaleId ?? null,
          serverSaleNumber: existing.serverSaleNumber ?? null,
          serverCashSessionId: existing.serverCashSessionId ?? null,
          serverSessionReference: existing.serverSessionReference ?? null,
          serverMovementId: existing.serverMovementId ?? null,
          serverVersion: existing.serverVersion ?? null,
          serverOpenedAt: existing.serverOpenedAt ?? null,
          serverClosedAt: existing.serverClosedAt ?? null,
          serverExpectedUsd: existing.serverExpectedUsd ?? null,
          serverExpectedCdf: existing.serverExpectedCdf ?? null,
          serverDeclaredUsd: existing.serverDeclaredUsd ?? null,
          serverDeclaredCdf: existing.serverDeclaredCdf ?? null,
          serverDifferenceUsd: existing.serverDifferenceUsd ?? null,
          serverDifferenceCdf: existing.serverDifferenceCdf ?? null,
          allocations,
        });
        continue;
      }

      try {
        const replayResult = await this.replayOperation(user, operation);

        await this.repository.recordProcessedOperation(user, {
          operationId: operation.operationId,
          localEntityId: 'localSaleId' in operation ? operation.localSaleId : operation.localCashSessionId,
          operationType: operation.operationType,
          payload: operation,
          serverSaleId: replayResult.serverSaleId ?? null,
          serverSaleNumber: replayResult.serverSaleNumber ?? null,
          serverCashSessionId: replayResult.serverCashSessionId ?? null,
          serverSessionReference: replayResult.serverSessionReference ?? null,
          serverMovementId: replayResult.serverMovementId ?? null,
          serverVersion: replayResult.serverVersion ?? null,
          serverOpenedAt: replayResult.serverOpenedAt ?? null,
          serverClosedAt: replayResult.serverClosedAt ?? null,
          serverExpectedUsd: replayResult.serverExpectedUsd ?? null,
          serverExpectedCdf: replayResult.serverExpectedCdf ?? null,
          serverDeclaredUsd: replayResult.serverDeclaredUsd ?? null,
          serverDeclaredCdf: replayResult.serverDeclaredCdf ?? null,
          serverDifferenceUsd: replayResult.serverDifferenceUsd ?? null,
          serverDifferenceCdf: replayResult.serverDifferenceCdf ?? null,
        });

        results.push({
          operationId: operation.operationId,
          localSaleId: 'localSaleId' in operation ? operation.localSaleId : null,
          status: 'SYNCED',
          ...replayResult,
        });
      } catch (error) {
        await this.repository.recordConflict(user, {
          operationId: operation.operationId,
          localSaleId: 'localSaleId' in operation ? operation.localSaleId : operation.localCashSessionId,
          workstationId: operation.workstationId,
          siteId: operation.siteId,
          offlineReference: 'offlineReference' in operation ? operation.offlineReference : operation.offlineCashReference,
          conflictCode: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
          message: error instanceof Error ? error.message : 'POS_SYNC_REPLAY_FAILED',
          localPayload: operation,
        });
        results.push({
          operationId: operation.operationId,
          localSaleId: 'localSaleId' in operation ? operation.localSaleId : null,
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

  private getOperationLocalEntityId(operation: SubmitPosOperation) {
    return 'localSaleId' in operation ? operation.localSaleId : operation.localCashSessionId;
  }

  private getOperationReference(operation: SubmitPosOperation) {
    return 'offlineReference' in operation ? operation.offlineReference : operation.offlineCashReference;
  }

  private async replayOperation(user: AuthUser, operation: SubmitPosOperation) {
    switch (operation.operationType) {
      case 'SALE_VALIDATE': {
        const validated = await this.salesService.replayOfflineValidatedSale(user, operation);
        return {
          serverSaleId: validated.saleId,
          serverSaleNumber: validated.saleNumber,
          allocations: validated.allocations,
        };
      }
      case 'CASH_SESSION_OPEN': {
        const opened = await this.cashService.replayOfflineOpenSession(user, operation as SubmitPosCashSessionOpenOperation);
        return {
          serverCashSessionId: opened.cashSessionId,
          serverSessionReference: opened.sessionReference,
          serverVersion: opened.serverVersion,
          serverOpenedAt: opened.serverOpenedAt ?? null,
        };
      }
      case 'CASH_EXPENSE': {
        const movement = await this.cashService.replayOfflineExpense(user, operation as SubmitPosCashExpenseOperation);
        return {
          serverCashSessionId: movement.cashSessionId,
          serverMovementId: movement.cashMovementId,
          serverVersion: movement.serverVersion ?? null,
        };
      }
      case 'CASH_SESSION_CLOSE': {
        const closed = await this.cashService.replayOfflineCloseSession(user, operation as SubmitPosCashSessionCloseOperation);
        return {
          serverCashSessionId: closed.cashSessionId,
          serverSessionReference: closed.sessionReference ?? null,
          serverVersion: closed.serverVersion ?? null,
          serverClosedAt: closed.serverClosedAt ?? null,
          serverExpectedUsd: closed.serverExpectedUsd ?? null,
          serverExpectedCdf: closed.serverExpectedCdf ?? null,
          serverDeclaredUsd: closed.serverDeclaredUsd ?? null,
          serverDeclaredCdf: closed.serverDeclaredCdf ?? null,
          serverDifferenceUsd: closed.serverDifferenceUsd ?? null,
          serverDifferenceCdf: closed.serverDifferenceCdf ?? null,
        };
      }
      default:
        throw new Error('OPERATION_NOT_SUPPORTED');
    }
  }
}
