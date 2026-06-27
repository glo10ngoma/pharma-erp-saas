import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('exchange-rate')
  @RequirePermission('settings.exchange_rate.read')
  @ApiOperation({ summary: 'Lire le taux USD/CDF du tenant courant' })
  getExchangeRate(@CurrentUser() user: AuthUser) {
    return this.service.getExchangeRate(user);
  }

  @Put('exchange-rate')
  @RequirePermission('settings.exchange_rate.update')
  @ApiOperation({ summary: 'Modifier le taux USD/CDF du tenant courant' })
  updateExchangeRate(@CurrentUser() user: AuthUser, @Body() dto: UpdateExchangeRateDto) {
    return this.service.updateExchangeRate(user, dto);
  }
}
