import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { ReceivablesService } from './receivables.service';

@ApiTags('receivables')
@ApiBearerAuth()
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly service: ReceivablesService) {}

  @Get()
  @RequirePermission('receivables.read')
  findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }

  @Get('summary')
  @RequirePermission('receivables.read')
  summary(@CurrentUser() user: AuthUser) { return this.service.summary(user); }

  @Get(':id')
  @RequirePermission('receivables.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }

  @Post(':id/pay')
  @RequirePermission('receivables.pay')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PayReceivableDto) { return this.service.pay(user, id, dto); }
}
