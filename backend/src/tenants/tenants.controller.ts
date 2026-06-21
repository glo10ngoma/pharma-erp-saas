import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @RequirePermission('tenants.read')
  findAll() {
    return this.service.findAll();
  }
}
