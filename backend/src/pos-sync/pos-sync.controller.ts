import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { BootstrapPosDto } from './dto/bootstrap-pos.dto';
import { ListPosChangesDto } from './dto/list-pos-changes.dto';
import { RegisterPosWorkstationDto } from './dto/register-pos-workstation.dto';
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
}

