import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { AccountingService } from './accounting.service';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(private readonly service: AccountingService) {}

  @Get('accounts')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Liste du plan comptable tenant' })
  findAccounts(@CurrentUser() user: AuthUser) { return this.service.findAccounts(user); }

  @Post('accounts')
  @RequirePermission('accounting.manage_accounts')
  @ApiOperation({ summary: 'Creer un compte comptable tenant' })
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto) { return this.service.createAccount(user, dto); }

  @Get('journals')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Liste des journaux comptables tenant' })
  findJournals(@CurrentUser() user: AuthUser) { return this.service.findJournals(user); }

  @Post('journals')
  @RequirePermission('accounting.manage_accounts')
  @ApiOperation({ summary: 'Creer un journal comptable tenant' })
  createJournal(@CurrentUser() user: AuthUser, @Body() dto: CreateJournalDto) { return this.service.createJournal(user, dto); }

  @Get('entries')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Liste des ecritures comptables' })
  findEntries(@CurrentUser() user: AuthUser) { return this.service.findEntries(user); }

  @Get('entries/:id')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Detail ecriture comptable' })
  findEntry(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findEntry(user, id); }

  @Post('entries/:id/post')
  @RequirePermission('accounting.post')
  @ApiOperation({ summary: 'Poster une ecriture brouillon equilibree' })
  postEntry(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.postEntry(user, id); }

  @Get('trial-balance')
  @RequirePermission('accounting.trial_balance')
  @ApiOperation({ summary: 'Balance comptable' })
  trialBalance(@CurrentUser() user: AuthUser) { return this.service.trialBalance(user); }

  @Get('general-ledger')
  @RequirePermission('accounting.general_ledger')
  @ApiOperation({ summary: 'Grand livre comptable' })
  generalLedger(@CurrentUser() user: AuthUser, @Query('accountCode') accountCode?: string) { return this.service.generalLedger(user, accountCode); }
}
