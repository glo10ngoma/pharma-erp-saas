import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateWorkstationDto } from './dto/create-workstation.dto';
import { UpdateWorkstationDto } from './dto/update-workstation.dto';
import { WorkstationsService } from './workstations.service';

@ApiTags('workstations')
@ApiBearerAuth()
@Controller('workstations')
export class WorkstationsController {
  constructor(private readonly service: WorkstationsService) {}

  @Get()
  @RequirePermission('cash_registers.read')
  @ApiOperation({ summary: 'Liste des postes de travail POS / back office' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermission('cash_registers.read')
  @ApiOperation({ summary: 'Detail poste de travail' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('workstations.manage')
  @ApiOperation({ summary: 'Creer un poste de travail' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkstationDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('workstations.manage')
  @ApiOperation({ summary: 'Modifier un poste de travail' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkstationDto) {
    return this.service.update(user, id, dto);
  }
}
