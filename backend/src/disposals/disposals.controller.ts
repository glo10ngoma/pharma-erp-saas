import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { DisposalsService } from './disposals.service';

@ApiTags('disposals')
@ApiBearerAuth()
@Controller('disposals')
export class DisposalsController {
  constructor(private readonly service: DisposalsService) {}

  @Get()
  @RequirePermission('disposals.read')
  findAll() {
    return this.service.findAll();
  }
}
