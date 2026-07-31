import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get('recent')
  @RequirePermission('audit.read')
  @ApiOperation({ summary: 'Activite recente unifiee' })
  findRecent(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.service.findRecent(user, limit ? Number(limit) : undefined);
  }
}
