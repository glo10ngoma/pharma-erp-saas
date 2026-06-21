import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CodeGeneratorService } from './code-generator.service';

@ApiTags('code-generator')
@ApiBearerAuth()
@Controller('code-generator')
export class CodeGeneratorController {
  constructor(private readonly service: CodeGeneratorService) {}

  @Get('next')
  @RequirePermission('articles.read')
  @ApiOperation({ summary: 'Proposer le prochain code tenant-scope pour une entite' })
  next(@CurrentUser() user: AuthUser, @Query('entity') entity: string) {
    return this.service.next(user, entity);
  }
}
