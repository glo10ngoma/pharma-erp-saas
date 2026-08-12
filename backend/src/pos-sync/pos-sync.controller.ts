import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { HeartbeatPosDto } from './dto/heartbeat-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { ListPosSyncAdminDto } from './dto/list-pos-sync-admin.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
import { ResolvePosSyncConflictDto } from './dto/resolve-pos-sync-conflict.dto';
import { SubmitPosOperationsDto } from './dto/submit-pos-operations.dto';
import { PosSyncService } from './pos-sync.service';

@ApiTags('pos-sync')
@ApiBearerAuth()
@Controller('pos-sync')
export class PosSyncController {
  constructor(private readonly service: PosSyncService) {}

  @Get('ping')
  @RequirePermission('pos_sync.read')
  @ApiOperation({ summary: 'Tester la disponibilite du backend POS Sync' })
  ping() {
    return this.service.ping();
  }

  @Post('workstations/register')
  @RequirePermission('pos_sync.execute')
  @ApiOperation({ summary: 'Enregistrer ou rattacher un poste POS par deviceId' })
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPosWorkstationDto) {
    return this.service.registerWorkstation(user, dto);
  }

  @Get('bootstrap')
  @RequirePermission('pos_sync.read')
  @ApiOperation({ summary: 'Bootstrap descendant POS offline pour un poste donne' })
  bootstrap(@CurrentUser() user: AuthUser, @Query() query: BootstrapPosDto) {
    return this.service.bootstrap(user, query);
  }

  @Get('changes')
  @RequirePermission('pos_sync.read')
  @ApiOperation({ summary: 'Changements descendants depuis un curseur opaque' })
  changes(@CurrentUser() user: AuthUser, @Query() query: ListPosChangesDto) {
    return this.service.changes(user, query);
  }

  @Post('operations')
  @RequirePermission('pos_sync.execute')
  @ApiOperation({ summary: 'Rejouer des operations POS offline de maniere idempotente' })
  pushOperations(@CurrentUser() user: AuthUser, @Body() dto: SubmitPosOperationsDto) {
    return this.service.pushOperations(user, dto);
  }

  @Post('heartbeat')
  @RequirePermission('pos_sync.read')
  @ApiOperation({ summary: 'Heartbeat leger d un poste POS offline' })
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: HeartbeatPosDto) {
    return this.service.heartbeat(user, dto);
  }

  @Get('admin/dashboard')
  @RequirePermission('pos_offline.admin.read')
  @ApiOperation({ summary: 'KPI de supervision offline par tenant/site' })
  adminDashboard(@CurrentUser() user: AuthUser, @Query() query: ListPosSyncAdminDto) {
    return this.service.adminDashboard(user, query);
  }

  @Get('admin/workstations')
  @RequirePermission('pos_offline.workstations.read')
  @ApiOperation({ summary: 'Liste des postes offline supervises' })
  adminWorkstations(@CurrentUser() user: AuthUser, @Query() query: ListPosSyncAdminDto) {
    return this.service.adminWorkstations(user, query);
  }

  @Get('admin/workstations/:id')
  @RequirePermission('pos_offline.workstations.read')
  @ApiOperation({ summary: 'Detail de supervision d un poste offline' })
  adminWorkstation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.adminWorkstation(user, id);
  }

  @Post('admin/workstations/:id/revoke')
  @RequirePermission('pos_offline.workstations.read')
  @ApiOperation({ summary: 'Revoquer un poste offline et liberer ses allocations restantes' })
  revokeWorkstation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.revokeWorkstation(user, id);
  }

  @Get('admin/conflicts')
  @RequirePermission('pos_sync.conflicts.read')
  @ApiOperation({ summary: 'Centre des conflits de synchronisation offline' })
  adminConflicts(@CurrentUser() user: AuthUser, @Query() query: ListPosSyncAdminDto) {
    return this.service.adminConflicts(user, query);
  }

  @Get('admin/conflicts/:id')
  @RequirePermission('pos_sync.conflicts.read')
  @ApiOperation({ summary: 'Detail d un conflit offline' })
  adminConflict(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.adminConflict(user, id);
  }

  @Post('admin/conflicts/:id/resolve')
  @RequirePermission('pos_sync.conflicts.resolve')
  @ApiOperation({ summary: 'Resolution explicite d un conflit offline' })
  resolveConflict(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResolvePosSyncConflictDto) {
    return this.service.resolveConflict(user, id, dto);
  }

  @Get('admin/logs')
  @RequirePermission('pos_sync.logs.read')
  @ApiOperation({ summary: 'Journal de supervision offline' })
  adminLogs(@CurrentUser() user: AuthUser, @Query() query: ListPosSyncAdminDto) {
    return this.service.adminLogs(user, query);
  }
}
