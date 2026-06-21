import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type Row = {
  category_id: string;
  tenant_id: string;
  category_code: string;
  category_name: string;
  description: string | null;
  is_active: boolean;
};

@Injectable()
export class CategoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<Row>(
      `SELECT category_id, tenant_id, category_code, category_name, description, is_active
       FROM categories WHERE tenant_id = $1 ORDER BY category_name`,
      [user.tenantId],
    );
    return result.rows.map(this.toDto);
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      `SELECT category_id, tenant_id, category_code, category_name, description, is_active
       FROM categories WHERE tenant_id = $1 AND category_id = $2 LIMIT 1`,
      [user.tenantId, id],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateCategoryDto) {
    const result = await this.db.query<Row>(
      `INSERT INTO categories (tenant_id, category_code, category_name, description, is_active)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING category_id, tenant_id, category_code, category_name, description, is_active`,
      [user.tenantId, dto.categoryCode, dto.categoryName, dto.description ?? null, dto.isActive ?? true],
    );
    return this.toDto(result.rows[0]);
  }

  async update(user: AuthUser, id: string, dto: UpdateCategoryDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    const result = await this.db.query<Row>(
      `UPDATE categories SET category_code=$3, category_name=$4, description=$5, is_active=$6
       WHERE tenant_id=$1 AND category_id=$2
       RETURNING category_id, tenant_id, category_code, category_name, description, is_active`,
      [
        user.tenantId,
        id,
        dto.categoryCode ?? current.categoryCode,
        dto.categoryName ?? current.categoryName,
        dto.description ?? current.description,
        dto.isActive ?? current.isActive,
      ],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async remove(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      `UPDATE categories SET is_active=false WHERE tenant_id=$1 AND category_id=$2
       RETURNING category_id, tenant_id, category_code, category_name, description, is_active`,
      [user.tenantId, id],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  private toDto(row: Row) {
    return {
      categoryId: row.category_id,
      tenantId: row.tenant_id,
      categoryCode: row.category_code,
      categoryName: row.category_name,
      description: row.description,
      isActive: row.is_active,
    };
  }
}
