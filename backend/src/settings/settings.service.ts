import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { SettingsRepository } from './settings.repository';

@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  getExchangeRate(user: AuthUser) {
    return this.repository.getExchangeRate(user);
  }

  updateExchangeRate(user: AuthUser, dto: UpdateExchangeRateDto) {
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) {
      throw new BadRequestException('INVALID_EXCHANGE_RATE');
    }

    return this.repository.updateExchangeRate(user, dto.rate);
  }
}
