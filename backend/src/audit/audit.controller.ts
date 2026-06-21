import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  findAll() {
    return this.service.findAll();
  }
}
