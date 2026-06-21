import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateGalenicFormDto } from './dto/create-galenic-form.dto';
import { UpdateGalenicFormDto } from './dto/update-galenic-form.dto';
import { GalenicFormsService } from './galenic-forms.service';

@ApiTags('galenic-forms')
@ApiBearerAuth()
@Controller('galenic-forms')
export class GalenicFormsController {
  constructor(private readonly service: GalenicFormsService) {}
  @Get() @RequirePermission('galenic_forms.read') @ApiOperation({ summary: 'Liste formes galeniques' }) findAll(@CurrentUser() user: AuthUser) { return this.service.findAll(user); }
  @Get(':id') @RequirePermission('galenic_forms.read') findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.findOne(user, id); }
  @Post() @RequirePermission('galenic_forms.create') create(@CurrentUser() user: AuthUser, @Body() dto: CreateGalenicFormDto) { return this.service.create(user, dto); }
  @Patch(':id') @RequirePermission('galenic_forms.update') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGalenicFormDto) { return this.service.update(user, id, dto); }
  @Delete(':id') @RequirePermission('galenic_forms.delete') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.remove(user, id); }
}
