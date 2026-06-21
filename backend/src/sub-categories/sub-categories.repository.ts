import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './dto/update-sub-category.dto';

type Row = {
  sub_category_id: string;
  tenant_id: string;
  category_id: string;
  category_name: string | null;
  sub_category_code: string;
  sub_category_name: string;
  description: string | null;
  is_active: boolean;
};

@Injectable()
export class SubCategoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<Row>(
      `SELECT sc.sub_category_id, sc.tenant_id, sc.category_id, c.category_name,
              sc.sub_category_code, sc.sub_category_name, sc.description, sc.is_active
       FROM sub_categories sc
       JOIN categories c ON c.category_id = sc.category_id AND c.tenant_id = sc.tenant_id
       WHERE sc.tenant_id = $1 ORDER BY sc.sub_category_name`,
      [user.tenantId],
    );
    return result.rows.map(this.toDto);
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      `SELECT sc.sub_category_id, sc.tenant_id, sc.category_id, c.category_name,
              sc.sub_category_code, sc.sub_category_name, sc.description, sc.is_active
       FROM sub_categories sc
       JOIN categories c ON c.category_id = sc.category_id AND c.tenant_id = sc.tenant_id
       WHERE sc.tenant_id = $1 AND sc.sub_category_id = $2 LIMIT 1`,
      [user.tenantId, id],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateSubCategoryDto) {
    await this.assertCategory(user, dto.categoryId);
    const result = await this.db.query<Row>(
      `INSERT INTO sub_categories (tenant_id, category_id, sub_category_code, sub_category_name, description, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING sub_category_id, tenant_id, category_id, NULL::text AS category_name,
                 sub_category_code, sub_category_name, description, is_active`,
      [user.tenantId, dto.categoryId, dto.subCategoryCode, dto.subCategoryName, dto.description ?? null, dto.isActive ?? true],
    );
    return this.findOne(user, result.rows[0].sub_category_id);
  }

  async update(user: AuthUser, id: string, dto: UpdateSubCategoryDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    const categoryId = dto.categoryId ?? current.categoryId;
    await this.assertCategory(user, categoryId);
    await this.db.query(
      `UPDATE sub_categories
       SET category_id=$3, sub_category_code=$4, sub_category_name=$5, description=$6, is_active=$7
       WHERE tenant_id=$1 AND sub_category_id=$2`,
      [
        user.tenantId,
        id,
        categoryId,
        dto.subCategoryCode ?? current.subCategoryCode,
        dto.subCategoryName ?? current.subCategoryName,
        dto.description ?? current.description,
        dto.isActive ?? current.isActive,
      ],
    );
    return this.findOne(user, id);
  }

  async remove(user: AuthUser, id: string) {
    await this.db.query(
      `UPDATE sub_categories SET is_active=false WHERE tenant_id=$1 AND sub_category_id=$2`,
      [user.tenantId, id],
    );
    return this.findOne(user, id);
  }

  private async assertCategory(user: AuthUser, categoryId: string) {
    const result = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM categories WHERE tenant_id=$1 AND category_id=$2 AND is_active=true`,
      [user.tenantId, categoryId],
    );
    if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('CATEGORY_NOT_IN_TENANT');
  }

  private toDto(row: Row) {
    return {
      subCategoryId: row.sub_category_id,
      tenantId: row.tenant_id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subCategoryCode: row.sub_category_code,
      subCategoryName: row.sub_category_name,
      description: row.description,
      isActive: row.is_active,
    };
  }
}
