import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/types/auth-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  @Get('organizations')
  @ApiOperation({ summary: 'Organisations accessibles pour l utilisateur courant' })
  organizations(@CurrentUser() user: AuthUser) {
    return this.service.organizations(user);
  }

  @Get('sites')
  @ApiOperation({ summary: 'Sites accessibles pour le tenant actif ou cible' })
  sites(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId?: string) {
    return this.service.sites(user, tenantId);
  }

  @Post('switch-organization')
  @ApiOperation({ summary: 'Changer le tenant actif sans modifier le tenant home' })
  switchOrganization(@CurrentUser() user: AuthUser, @Body() dto: { tenantId: string }) {
    return this.service.switchOrganization(user, dto.tenantId);
  }

  @Post('switch-site')
  @ApiOperation({ summary: 'Changer le site actif dans le tenant actif' })
  switchSite(@CurrentUser() user: AuthUser, @Body() dto: { siteId: string }) {
    return this.service.switchSite(user, dto.siteId);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Changer le mot de passe utilisateur courant' })
  @ApiOkResponse({
    description: 'Mot de passe change. Le frontend doit deconnecter l utilisateur.',
    schema: { example: { changed: true } },
  })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user, dto);
  }
}
