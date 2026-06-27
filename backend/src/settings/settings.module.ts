import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [SettingsRepository, SettingsService],
})
export class SettingsModule {}
