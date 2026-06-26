import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';

type EntityConfig = {
  prefix: string;
  table: string;
  column: string;
};

const ENTITIES: Record<string, EntityConfig> = {
  articles: { prefix: 'ART', table: 'articles', column: 'article_code' },
  customers: { prefix: 'CLI', table: 'customers', column: 'customer_code' },
  suppliers: { prefix: 'FRN', table: 'suppliers', column: 'supplier_code' },
  users: { prefix: 'USR', table: 'users', column: 'username' },
  sites: { prefix: 'SIT', table: 'sites', column: 'site_code' },
  categories: { prefix: 'CAT', table: 'categories', column: 'category_code' },
  sub_categories: { prefix: 'SCT', table: 'sub_categories', column: 'sub_category_code' },
  galenic_forms: { prefix: 'FRM', table: 'galenic_forms', column: 'form_code' },
  administration_routes: { prefix: 'VOI', table: 'administration_routes', column: 'route_code' },
  product_types: { prefix: 'TYP', table: 'product_types', column: 'type_code' },
  purchases: { prefix: 'ACH', table: 'purchases', column: 'purchase_number' },
  transfers: { prefix: 'TRF', table: 'stock_transfers', column: 'transfer_number' },
  sales: { prefix: 'VEN', table: 'sales', column: 'sale_number' },
  inventories: { prefix: 'INV', table: 'inventory_sessions', column: 'inventory_number' },
  organizations: { prefix: 'ORG', table: 'organizations', column: 'organization_code' },
  insurance_plans: { prefix: 'PLA', table: 'insurance_plans', column: 'plan_code' },
  memberships: { prefix: 'MEM', table: 'customer_memberships', column: 'member_number' },
};

@Injectable()
export class CodeGeneratorService {
  constructor(private readonly db: DatabaseService) {}

  async next(user: AuthUser, entity: string) {
    const config = ENTITIES[entity];
    if (!config) throw new BadRequestException('UNSUPPORTED_CODE_ENTITY');

    const result = await this.db.query<{ code: string }>(
      `
      SELECT ${config.column} AS code
      FROM ${config.table}
      WHERE tenant_id = $1
        AND ${config.column} ~ ('^' || $2 || '-[0-9]+$')
      ORDER BY (${this.suffixExpression(config.column)}) DESC
      LIMIT 1
      `,
      [user.tenantId, config.prefix],
    );

    const lastCode = result.rows[0]?.code;
    const lastNumber = lastCode ? Number(lastCode.split('-').pop()) : 0;
    return {
      entity,
      code: `${config.prefix}-${String(lastNumber + 1).padStart(6, '0')}`,
    };
  }

  private suffixExpression(column: string) {
    return `substring(${column} from '[0-9]+$')::int`;
  }
}
