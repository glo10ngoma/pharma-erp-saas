import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('login')
  @ApiOkResponse({
    description: 'Connexion reussie',
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        user: {
          id: 'uuid',
          tenantId: 'uuid',
          siteId: 'uuid',
          fullName: 'Admin Demo',
          email: 'admin@demo.local',
          role: 'ADMIN',
          permissions: ['articles.read', 'sales.create'],
        },
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Get('me')
  @ApiOkResponse({
    description: 'Profil utilisateur courant',
    schema: {
      example: {
        id: 'uuid',
        tenantId: 'uuid',
        siteId: 'uuid',
        fullName: 'Admin Demo',
        email: 'admin@demo.local',
        role: 'ADMIN',
        permissions: ['articles.read', 'sales.create'],
      },
    },
  })
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user);
  }
}
