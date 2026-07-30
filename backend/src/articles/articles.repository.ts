import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

type ArticleRow = {
  article_id: string;
  article_code: string;
  commercial_name: string;
  dci: string | null;
  dci_id: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  form_id: string | null;
  route_id: string | null;
  product_type_id: string | null;
  dosage: string | null;
  dosage_id: string | null;
  packaging: string | null;
  units_per_package: string | null;
  sales_unit_id: string | null;
  packaging_unit_id: string | null;
  atc_code: string | null;
  atc_id: string | null;
  barcode: string | null;
  prescription_required: boolean;
  default_stock_min: string;
  default_stock_max: string | null;
  is_active: boolean;
  stock_available: string;
  selling_price: string | null;
};

@Injectable()
export class ArticlesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser, query: ListArticlesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;
    const filters = ['a.tenant_id = $1'];
    const params: unknown[] = [user.tenantId];

    if (query.categoryId) {
      params.push(query.categoryId);
      filters.push(`a.category_id = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(`(
        a.article_code ILIKE $${params.length}
        OR a.commercial_name ILIKE $${params.length}
        OR a.dci ILIKE $${params.length}
        OR a.dosage ILIKE $${params.length}
        OR a.atc_code ILIKE $${params.length}
        OR a.barcode ILIKE $${params.length}
      )`);
    }

    const where = filters.join(' AND ');
    const count = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM articles a WHERE ${where}`,
      params,
    );

    const rows = await this.db.query<ArticleRow>(
      `
      SELECT
        a.article_id,
        a.article_code,
        a.commercial_name,
        a.dci,
        a.dci_id,
        a.category_id,
        a.sub_category_id,
        a.form_id,
        a.route_id,
        a.product_type_id,
        a.dosage,
        a.dosage_id,
        a.packaging,
        a.units_per_package,
        a.sales_unit_id,
        a.packaging_unit_id,
        a.atc_code,
        a.atc_id,
        a.barcode,
        a.prescription_required,
        a.default_stock_min,
        a.default_stock_max,
        a.is_active,
        COALESCE(SUM(s.quantity_available), 0) AS stock_available,
        MIN(l.selling_price) FILTER (
          WHERE s.quantity_available > 0
            AND l.is_blocked = false
            AND l.expiry_date > CURRENT_DATE
        ) AS selling_price
      FROM articles a
      LEFT JOIN lots l ON l.article_id = a.article_id AND l.tenant_id = a.tenant_id
      LEFT JOIN stocks s ON s.lot_id = l.lot_id AND s.tenant_id = a.tenant_id
      WHERE ${where}
      GROUP BY a.article_id
      ORDER BY a.commercial_name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    return {
      items: rows.rows.map(this.toArticle),
      total: Number(count.rows[0]?.total ?? 0),
      page,
      limit,
    };
  }

  async findOne(user: AuthUser, articleId: string) {
    const result = await this.db.query<ArticleRow>(
      `
      SELECT
        a.article_id, a.article_code, a.commercial_name, a.dci, a.dci_id, a.category_id,
        a.sub_category_id, a.form_id, a.route_id, a.product_type_id, a.dosage, a.dosage_id,
        a.packaging, a.units_per_package, a.sales_unit_id, a.packaging_unit_id, a.atc_code, a.atc_id, a.barcode, a.prescription_required, a.default_stock_min,
        a.default_stock_max, a.is_active, 0::numeric AS stock_available,
        NULL::numeric AS selling_price
      FROM articles a
      WHERE a.tenant_id = $1 AND a.article_id = $2
      LIMIT 1
      `,
      [user.tenantId, articleId],
    );
    return result.rows[0] ? this.toArticle(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateArticleDto) {
    const refs = await this.resolveReferenceValues(user, dto);
    const result = await this.db.query<ArticleRow>(
      `
      INSERT INTO articles (
        tenant_id, article_code, commercial_name, dci, category_id, sub_category_id,
        form_id, route_id, product_type_id, dosage, packaging, units_per_package, atc_code,
        prescription_required, barcode, sales_unit_id, packaging_unit_id, dosage_id, dci_id, atc_id,
        default_stock_min, default_stock_max, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING
        article_id,
        article_code,
        commercial_name,
        dci,
        dci_id,
        category_id,
        sub_category_id,
        form_id,
        route_id,
        product_type_id,
        dosage,
        dosage_id,
        packaging,
        units_per_package,
        sales_unit_id,
        packaging_unit_id,
        atc_code,
        atc_id,
        barcode,
        prescription_required,
        default_stock_min,
        default_stock_max,
        is_active,
        0::numeric AS stock_available,
        NULL::numeric AS selling_price
      `,
      [
        user.tenantId,
        dto.articleCode,
        dto.commercialName,
        dto.dci ?? null,
        dto.categoryId ?? null,
        dto.subCategoryId ?? null,
        dto.formId ?? null,
        dto.routeId ?? null,
        dto.productTypeId ?? null,
        refs.dosage,
        refs.packaging,
        dto.unitsPerPackage ?? null,
        refs.atcCode,
        dto.prescriptionRequired ?? false,
        dto.barcode ?? null,
        dto.salesUnitId ?? null,
        dto.packagingUnitId ?? null,
        dto.dosageId ?? null,
        dto.dciId ?? null,
        dto.atcId ?? null,
        dto.defaultStockMin ?? 0,
        dto.defaultStockMax ?? null,
        dto.isActive ?? true,
      ],
    );

    return this.toArticle(result.rows[0]);
  }

  async update(user: AuthUser, articleId: string, dto: UpdateArticleDto) {
    const current = await this.findOne(user, articleId);
    if (!current) return null;
    await this.assertReferences(user, {
      categoryId: dto.categoryId ?? current.categoryId ?? undefined,
      subCategoryId: dto.subCategoryId ?? current.subCategoryId ?? undefined,
      formId: dto.formId ?? current.formId ?? undefined,
      routeId: dto.routeId ?? current.routeId ?? undefined,
      productTypeId: dto.productTypeId ?? current.productTypeId ?? undefined,
      salesUnitId: dto.salesUnitId ?? current.salesUnitId ?? undefined,
      packagingUnitId: dto.packagingUnitId ?? current.packagingUnitId ?? undefined,
      dosageId: dto.dosageId ?? current.dosageId ?? undefined,
      dciId: dto.dciId ?? current.dciId ?? undefined,
      atcId: dto.atcId ?? current.atcId ?? undefined,
    });
    const refs = await this.resolveReferenceValues(user, {
      ...current,
      ...dto,
      salesUnitId: dto.salesUnitId ?? current.salesUnitId ?? undefined,
      packagingUnitId: dto.packagingUnitId ?? current.packagingUnitId ?? undefined,
      dosageId: dto.dosageId ?? current.dosageId ?? undefined,
      dciId: dto.dciId ?? current.dciId ?? undefined,
      atcId: dto.atcId ?? current.atcId ?? undefined,
    });

    await this.db.query(
      `
      UPDATE articles SET
        article_code=$3, commercial_name=$4, dci=$5, category_id=$6, sub_category_id=$7,
        form_id=$8, route_id=$9, product_type_id=$10, dosage=$11, packaging=$12,
        units_per_package=$13, atc_code=$14, prescription_required=$15, barcode=$16, default_stock_min=$17,
        default_stock_max=$18, sales_unit_id=$19, packaging_unit_id=$20, dosage_id=$21, dci_id=$22, atc_id=$23,
        is_active=$24,
        updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=$1 AND article_id=$2
      `,
      [
        user.tenantId,
        articleId,
        dto.articleCode ?? current.articleCode,
        dto.commercialName ?? current.commercialName,
        refs.dci,
        dto.categoryId ?? current.categoryId,
        dto.subCategoryId ?? current.subCategoryId,
        dto.formId ?? current.formId,
        dto.routeId ?? current.routeId,
        dto.productTypeId ?? current.productTypeId,
        refs.dosage,
        refs.packaging,
        dto.unitsPerPackage ?? current.unitsPerPackage,
        refs.atcCode,
        dto.prescriptionRequired ?? current.prescriptionRequired,
        dto.barcode ?? current.barcode,
        dto.defaultStockMin ?? current.defaultStockMin,
        dto.defaultStockMax ?? current.defaultStockMax,
        dto.salesUnitId ?? current.salesUnitId,
        dto.packagingUnitId ?? current.packagingUnitId,
        dto.dosageId ?? current.dosageId,
        dto.dciId ?? current.dciId,
        dto.atcId ?? current.atcId,
        dto.isActive ?? current.isActive,
      ],
    );
    return this.findOne(user, articleId);
  }

  async remove(user: AuthUser, articleId: string) {
    await this.db.query(
      `UPDATE articles SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$1 AND article_id=$2`,
      [user.tenantId, articleId],
    );
    return this.findOne(user, articleId);
  }

  private async assertReferences(
    user: AuthUser,
    refs: Pick<CreateArticleDto, 'categoryId' | 'subCategoryId' | 'formId' | 'routeId' | 'productTypeId' | 'salesUnitId' | 'packagingUnitId' | 'dosageId' | 'dciId' | 'atcId'>,
  ) {
    const checks: Array<[string, string, string, string]> = [];
    if (refs.categoryId) checks.push(['categories', 'category_id', refs.categoryId, 'CATEGORY_NOT_IN_TENANT']);
    if (refs.formId) checks.push(['galenic_forms', 'form_id', refs.formId, 'FORM_NOT_IN_TENANT']);
    if (refs.routeId) checks.push(['administration_routes', 'route_id', refs.routeId, 'ROUTE_NOT_IN_TENANT']);
    if (refs.productTypeId) checks.push(['product_types', 'product_type_id', refs.productTypeId, 'PRODUCT_TYPE_NOT_IN_TENANT']);
    if (refs.salesUnitId) checks.push(['product_units', 'product_unit_id', refs.salesUnitId, 'SALES_UNIT_NOT_IN_TENANT']);
    if (refs.packagingUnitId) checks.push(['product_units', 'product_unit_id', refs.packagingUnitId, 'PACKAGING_UNIT_NOT_IN_TENANT']);
    if (refs.dosageId) checks.push(['dosages', 'dosage_id', refs.dosageId, 'DOSAGE_NOT_IN_TENANT']);
    if (refs.dciId) checks.push(['active_ingredients', 'active_ingredient_id', refs.dciId, 'DCI_NOT_IN_TENANT']);
    if (refs.atcId) checks.push(['atc_codes', 'atc_id', refs.atcId, 'ATC_NOT_IN_TENANT']);

    for (const [table, column, id, error] of checks) {
      const result = await this.db.query<{ total: string }>(
        `SELECT COUNT(*)::int AS total FROM ${table} WHERE tenant_id=$1 AND ${column}=$2`,
        [user.tenantId, id],
      );
      if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error(error);
    }

    if (refs.subCategoryId) {
      const result = await this.db.query<{ total: string }>(
        `SELECT COUNT(*)::int AS total
         FROM sub_categories
         WHERE tenant_id=$1 AND sub_category_id=$2
           AND ($3::uuid IS NULL OR category_id=$3::uuid)`,
        [user.tenantId, refs.subCategoryId, refs.categoryId ?? null],
      );
      if (Number(result.rows[0]?.total ?? 0) !== 1) throw new Error('SUB_CATEGORY_NOT_IN_TENANT');
    }
  }

  private async resolveReferenceValues(
    user: AuthUser,
    dto: {
      dci?: string | null;
      dosage?: string | null;
      atcCode?: string | null;
      packaging?: string | null;
      salesUnitId?: string;
      dciId?: string;
      dosageId?: string;
      atcId?: string;
      packagingUnitId?: string;
    },
  ) {
    let dci = dto.dci ?? null;
    let dosage = dto.dosage ?? null;
    let atcCode = dto.atcCode ?? null;
    let packaging = dto.packaging ?? null;

    if (dto.dciId) {
      const result = await this.db.query<{ canonical_name: string }>(
        `SELECT canonical_name FROM active_ingredients WHERE tenant_id=$1 AND active_ingredient_id=$2 LIMIT 1`,
        [user.tenantId, dto.dciId],
      );
      dci = result.rows[0]?.canonical_name ?? dci;
    }

    if (dto.dosageId) {
      const result = await this.db.query<{ dosage_label: string }>(
        `SELECT dosage_label FROM dosages WHERE tenant_id=$1 AND dosage_id=$2 LIMIT 1`,
        [user.tenantId, dto.dosageId],
      );
      dosage = result.rows[0]?.dosage_label ?? dosage;
    }

    if (dto.atcId) {
      const result = await this.db.query<{ atc_code: string }>(
        `SELECT atc_code FROM atc_codes WHERE tenant_id=$1 AND atc_id=$2 LIMIT 1`,
        [user.tenantId, dto.atcId],
      );
      atcCode = result.rows[0]?.atc_code ?? atcCode;
    }

    if (dto.packagingUnitId) {
      const result = await this.db.query<{ unit_label: string }>(
        `SELECT unit_label FROM product_units WHERE tenant_id=$1 AND product_unit_id=$2 LIMIT 1`,
        [user.tenantId, dto.packagingUnitId],
      );
      packaging = result.rows[0]?.unit_label ?? packaging;
    }

    return { dci, dosage, atcCode, packaging };
  }

  private toArticle(row: ArticleRow) {
    return {
      articleId: row.article_id,
      articleCode: row.article_code,
      commercialName: row.commercial_name,
      dci: row.dci,
      dciId: row.dci_id,
      categoryId: row.category_id,
      subCategoryId: row.sub_category_id,
      formId: row.form_id,
      routeId: row.route_id,
      productTypeId: row.product_type_id,
      dosage: row.dosage,
      dosageId: row.dosage_id,
      packaging: row.packaging,
      unitsPerPackage: row.units_per_package === null ? null : Number(row.units_per_package),
      salesUnitId: row.sales_unit_id,
      packagingUnitId: row.packaging_unit_id,
      atcCode: row.atc_code,
      atcId: row.atc_id,
      barcode: row.barcode,
      prescriptionRequired: row.prescription_required,
      defaultStockMin: Number(row.default_stock_min),
      defaultStockMax: row.default_stock_max === null ? null : Number(row.default_stock_max),
      isActive: row.is_active,
      stockAvailable: Number(row.stock_available),
      sellingPrice: row.selling_price === null ? null : Number(row.selling_price),
    };
  }
}
