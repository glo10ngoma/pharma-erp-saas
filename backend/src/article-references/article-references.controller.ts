import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { ArticleReferencesService } from './article-references.service';
import { CreateActiveIngredientDto } from './dto/create-active-ingredient.dto';
import { CreateAtcCodeDto } from './dto/create-atc-code.dto';
import { CreateDosageDto } from './dto/create-dosage.dto';
import { CreateProductUnitDto } from './dto/create-product-unit.dto';

@ApiTags('article-references')
@ApiBearerAuth()
@Controller()
export class ArticleReferencesController {
  constructor(private readonly service: ArticleReferencesService) {}

  @Get('product-units')
  @RequirePermission('product_units.read')
  @ApiOperation({ summary: 'Liste des unites produit du tenant courant' })
  findAllProductUnits(@CurrentUser() user: AuthUser) {
    return this.service.findAllProductUnits(user);
  }

  @Post('product-units')
  @RequirePermission('product_units.create')
  createProductUnit(@CurrentUser() user: AuthUser, @Body() dto: CreateProductUnitDto) {
    return this.service.createProductUnit(user, dto);
  }

  @Get('dosages')
  @RequirePermission('dosages.read')
  @ApiOperation({ summary: 'Liste des dosages du tenant courant' })
  findAllDosages(@CurrentUser() user: AuthUser) {
    return this.service.findAllDosages(user);
  }

  @Post('dosages')
  @RequirePermission('dosages.create')
  createDosage(@CurrentUser() user: AuthUser, @Body() dto: CreateDosageDto) {
    return this.service.createDosage(user, dto);
  }

  @Get('active-ingredients')
  @RequirePermission('active_ingredients.read')
  @ApiOperation({ summary: 'Liste des DCI du tenant courant' })
  findAllActiveIngredients(@CurrentUser() user: AuthUser) {
    return this.service.findAllActiveIngredients(user);
  }

  @Post('active-ingredients')
  @RequirePermission('active_ingredients.create')
  createActiveIngredient(@CurrentUser() user: AuthUser, @Body() dto: CreateActiveIngredientDto) {
    return this.service.createActiveIngredient(user, dto);
  }

  @Get('atc-codes')
  @RequirePermission('atc_codes.read')
  @ApiOperation({ summary: 'Liste des codes ATC du tenant courant' })
  findAllAtcCodes(@CurrentUser() user: AuthUser) {
    return this.service.findAllAtcCodes(user);
  }

  @Post('atc-codes')
  @RequirePermission('atc_codes.create')
  createAtcCode(@CurrentUser() user: AuthUser, @Body() dto: CreateAtcCodeDto) {
    return this.service.createAtcCode(user, dto);
  }
}
