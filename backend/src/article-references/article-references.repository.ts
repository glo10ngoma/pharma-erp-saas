import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateActiveIngredientDto } from './dto/create-active-ingredient.dto';
import { CreateAtcCodeDto } from './dto/create-atc-code.dto';
import { CreateDosageDto } from './dto/create-dosage.dto';
import { CreateProductUnitDto } from './dto/create-product-unit.dto';

type ProductUnitRow = {
  product_unit_id: string;
  tenant_id: string;
  unit_code: string;
  unit_label: string;
  is_active: boolean;
};

type DosageRow = {
  dosage_id: string;
  tenant_id: string;
  dosage_label: string;
  normalized_label: string;
  is_active: boolean;
};

type ActiveIngredientRow = {
  active_ingredient_id: string;
  tenant_id: string;
  canonical_name: string;
  normalized_name: string;
  is_active: boolean;
};

type AtcCodeRow = {
  atc_id: string;
  tenant_id: string;
  atc_code: string;
  atc_label: string;
  atc_level: string | null;
  parent_code: string | null;
  is_active: boolean;
};

@Injectable()
export class ArticleReferencesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAllProductUnits(user: AuthUser) {
    const result = await this.db.query<ProductUnitRow>(
      `SELECT product_unit_id, tenant_id, unit_code, unit_label, is_active
       FROM product_units
       WHERE tenant_id=$1
       ORDER BY unit_label ASC`,
      [user.tenantId],
    );
    return result.rows.map(this.toProductUnit);
  }

  async createProductUnit(user: AuthUser, dto: CreateProductUnitDto) {
    const result = await this.db.query<ProductUnitRow>(
      `
      INSERT INTO product_units (tenant_id, unit_code, unit_label, normalized_label)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, normalized_label)
      DO UPDATE SET unit_code = EXCLUDED.unit_code, unit_label = EXCLUDED.unit_label, is_active = true, updated_at = CURRENT_TIMESTAMP
      RETURNING product_unit_id, tenant_id, unit_code, unit_label, is_active
      `,
      [user.tenantId, dto.unitCode.trim().toUpperCase(), dto.unitLabel.trim(), this.normalize(dto.unitLabel)],
    );
    return this.toProductUnit(result.rows[0]);
  }

  async findAllDosages(user: AuthUser) {
    const result = await this.db.query<DosageRow>(
      `SELECT dosage_id, tenant_id, dosage_label, normalized_label, is_active
       FROM dosages
       WHERE tenant_id=$1
       ORDER BY dosage_label ASC`,
      [user.tenantId],
    );
    return result.rows.map(this.toDosage);
  }

  async createDosage(user: AuthUser, dto: CreateDosageDto) {
    const label = dto.dosageLabel.trim();
    const result = await this.db.query<DosageRow>(
      `
      INSERT INTO dosages (tenant_id, dosage_label, normalized_label)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, normalized_label)
      DO UPDATE SET dosage_label = EXCLUDED.dosage_label, is_active = true, updated_at = CURRENT_TIMESTAMP
      RETURNING dosage_id, tenant_id, dosage_label, normalized_label, is_active
      `,
      [user.tenantId, label, this.normalize(label)],
    );
    return this.toDosage(result.rows[0]);
  }

  async findAllActiveIngredients(user: AuthUser) {
    const result = await this.db.query<ActiveIngredientRow>(
      `SELECT active_ingredient_id, tenant_id, canonical_name, normalized_name, is_active
       FROM active_ingredients
       WHERE tenant_id=$1
       ORDER BY canonical_name ASC`,
      [user.tenantId],
    );
    return result.rows.map(this.toActiveIngredient);
  }

  async createActiveIngredient(user: AuthUser, dto: CreateActiveIngredientDto) {
    const canonicalName = dto.canonicalName.trim();
    const result = await this.db.query<ActiveIngredientRow>(
      `
      INSERT INTO active_ingredients (tenant_id, canonical_name, normalized_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, normalized_name)
      DO UPDATE SET canonical_name = EXCLUDED.canonical_name, is_active = true, updated_at = CURRENT_TIMESTAMP
      RETURNING active_ingredient_id, tenant_id, canonical_name, normalized_name, is_active
      `,
      [user.tenantId, canonicalName, this.normalize(canonicalName)],
    );
    return this.toActiveIngredient(result.rows[0]);
  }

  async findAllAtcCodes(user: AuthUser) {
    const result = await this.db.query<AtcCodeRow>(
      `SELECT atc_id, tenant_id, atc_code, atc_label, atc_level, parent_code, is_active
       FROM atc_codes
       WHERE tenant_id=$1
       ORDER BY atc_code ASC`,
      [user.tenantId],
    );
    return result.rows.map(this.toAtcCode);
  }

  async createAtcCode(user: AuthUser, dto: CreateAtcCodeDto) {
    const atcCode = dto.atcCode.trim().toUpperCase();
    const result = await this.db.query<AtcCodeRow>(
      `
      INSERT INTO atc_codes (tenant_id, atc_code, atc_label, atc_level, parent_code)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, atc_code)
      DO UPDATE SET atc_label = EXCLUDED.atc_label, atc_level = EXCLUDED.atc_level, parent_code = EXCLUDED.parent_code, is_active = true, updated_at = CURRENT_TIMESTAMP
      RETURNING atc_id, tenant_id, atc_code, atc_label, atc_level, parent_code, is_active
      `,
      [user.tenantId, atcCode, dto.atcLabel.trim(), dto.level?.trim() || null, dto.parentCode?.trim().toUpperCase() || null],
    );
    return this.toAtcCode(result.rows[0]);
  }

  private toProductUnit(row: ProductUnitRow) {
    return {
      productUnitId: row.product_unit_id,
      tenantId: row.tenant_id,
      unitCode: row.unit_code,
      unitLabel: row.unit_label,
      isActive: row.is_active,
    };
  }

  private toDosage(row: DosageRow) {
    return {
      dosageId: row.dosage_id,
      tenantId: row.tenant_id,
      dosageLabel: row.dosage_label,
      isActive: row.is_active,
    };
  }

  private toActiveIngredient(row: ActiveIngredientRow) {
    return {
      activeIngredientId: row.active_ingredient_id,
      tenantId: row.tenant_id,
      canonicalName: row.canonical_name,
      isActive: row.is_active,
    };
  }

  private toAtcCode(row: AtcCodeRow) {
    return {
      atcId: row.atc_id,
      tenantId: row.tenant_id,
      atcCode: row.atc_code,
      atcLabel: row.atc_label,
      level: row.atc_level,
      parentCode: row.parent_code,
      isActive: row.is_active,
    };
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
