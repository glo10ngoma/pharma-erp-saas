import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Liste des utilisateurs du tenant courant' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Detail utilisateur du tenant courant' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post()
  @RequirePermission('users.create')
  @ApiOperation({ summary: 'Creer un utilisateur dans le tenant courant' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  @ApiOperation({ summary: 'Modifier un utilisateur du tenant courant' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('users.delete')
  @ApiOperation({ summary: 'Desactiver un utilisateur du tenant courant' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
