import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  @RequirePermission('attachments.read')
  findAll() {
    return this.service.findAll();
  }
}
