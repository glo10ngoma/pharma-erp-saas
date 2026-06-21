import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { LotsService } from './lots.service';

@ApiTags('lots')
@ApiBearerAuth()
@Controller('lots')
export class LotsController {
  constructor(private readonly service: LotsService) {}
  @Get() @RequirePermission('lots.read') @ApiOperation({ summary: 'Liste lots' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':id') @RequirePermission('lots.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post(':id/block') @RequirePermission('lots.block') block(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('reason') reason?: string) { return this.service.block(user, id, reason); }
  @Post(':id/unblock') @RequirePermission('lots.block') unblock(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.unblock(user, id); }
}
