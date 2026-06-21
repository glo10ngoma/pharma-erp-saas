import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashExpenseDto } from './dto/create-cash-expense.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CashService } from './cash.service';

@ApiTags('cash')
@ApiBearerAuth()
@Controller('cash')
export class CashController {
  constructor(private readonly service: CashService) {}

  @Get('sessions')
  @RequirePermission('cash_registers.read')
  @ApiOperation({ summary: 'Liste des sessions caisse' })
  findSessions(@CurrentUser() user: AuthUser) {
    return this.service.findSessions(user);
  }

  @Post('sessions/open')
  @RequirePermission('cash_sessions.open')
  @ApiOperation({ summary: 'Ouvrir une session caisse' })
  openSession(@CurrentUser() user: AuthUser, @Body() dto: OpenCashSessionDto) {
    return this.service.openSession(user, dto);
  }

  @Get('sessions/current')
  @RequirePermission('cash_registers.read')
  @ApiOperation({ summary: 'Session caisse ouverte courante' })
  currentSession(@CurrentUser() user: AuthUser, @Query('siteId') siteId?: string) {
    return this.service.currentSession(user, siteId);
  }

  @Post('sessions/:id/close')
  @RequirePermission('cash_sessions.close')
  @ApiOperation({ summary: 'Fermer une session caisse' })
  closeSession(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CloseCashSessionDto) {
    return this.service.closeSession(user, id, dto);
  }

  @Get('movements')
  @RequirePermission('cash_registers.read')
  @ApiOperation({ summary: 'Liste des mouvements caisse' })
  findMovements(@CurrentUser() user: AuthUser, @Query('sessionId') sessionId?: string) {
    return this.service.findMovements(user, sessionId);
  }

  @Post('expenses')
  @RequirePermission('cash_expenses.create')
  @ApiOperation({ summary: 'Creer une depense caisse' })
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateCashExpenseDto) {
    return this.service.createExpense(user, dto);
  }
}
