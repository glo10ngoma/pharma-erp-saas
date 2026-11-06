import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ArticleReferencesRepository } from './article-references.repository';
import { CreateActiveIngredientDto } from './dto/create-active-ingredient.dto';
import { CreateAtcCodeDto } from './dto/create-atc-code.dto';
import { CreateDosageDto } from './dto/create-dosage.dto';
import { CreateProductUnitDto } from './dto/create-product-unit.dto';

@Injectable()
export class ArticleReferencesService {
  constructor(private readonly repository: ArticleReferencesRepository) {}

  findAllProductUnits(user: AuthUser) {
    return this.repository.findAllProductUnits(user);
  }

  createProductUnit(user: AuthUser, dto: CreateProductUnitDto) {
    return this.repository.createProductUnit(user, dto).catch(this.handleUnitConflict);
  }

  async updateProductUnit(user: AuthUser, id: string, dto: CreateProductUnitDto) {
    const unit = await this.repository.updateProductUnit(user, id, dto).catch(this.handleUnitConflict);
    if (!unit) throw new NotFoundException('Unité de mesure introuvable.');
    return unit;
  }

  private handleUnitConflict(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new ConflictException('Ce code ou ce libellé est déjà utilisé.');
    }
    throw error;
  }

  findAllDosages(user: AuthUser) {
    return this.repository.findAllDosages(user);
  }

  createDosage(user: AuthUser, dto: CreateDosageDto) {
    return this.repository.createDosage(user, dto);
  }

  findAllActiveIngredients(user: AuthUser) {
    return this.repository.findAllActiveIngredients(user);
  }

  createActiveIngredient(user: AuthUser, dto: CreateActiveIngredientDto) {
    return this.repository.createActiveIngredient(user, dto);
  }

  findAllAtcCodes(user: AuthUser) {
    return this.repository.findAllAtcCodes(user);
  }

  createAtcCode(user: AuthUser, dto: CreateAtcCodeDto) {
    return this.repository.createAtcCode(user, dto);
  }
}
