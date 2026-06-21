import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get()
  @RequirePermission('transfers.read')
  findAll() {
    return this.service.findAll();
  }
}
