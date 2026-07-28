import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Etat applicatif minimal' })
  appHealth() {
    return { status: 'ok' };
  }

  @Get('db')
  @Public()
  @ApiOperation({ summary: 'Etat de disponibilite PostgreSQL' })
  async dbHealth() {
    try {
      await this.db.ping();
      return { status: 'ok', database: 'available' };
    } catch {
      throw new HttpException(
        { status: 'error', database: 'unavailable', message: 'DATABASE_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
