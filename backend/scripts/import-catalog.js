#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'tmp', 'catalog-import-report.json');
const REQUIRED_COLUMNS = [
  'Code article',
  'Produit',
  'Categorie pharmaceutique',
  'Sous-categorie',
  'Forme galenique / type',
  'Confiance',
  'Statut validation',
];

function main() {
  loadEnv(path.join(ROOT, '.env'));
  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);

  return withPool(async (pool) => {
    const workbookRows = readWorkbook(options.file, options.sheet);
    const normalizedRows = normalizeRows(workbookRows, options.limit);
    const validation = validateRows(normalizedRows);
    const context = await resolveContext(pool, options);
    const audit = await auditSchema(pool);
    const planning = await planImport(pool, context, validation.validRows, options.batchSize);
    const report = buildReport(audit, context, validation, planning, options);

    if (options.apply) {
      await applyImport(pool, context, planning, options.batchSize);
      report.databaseModified = true;
    }

    await writeReport(report);
    printSummary(report);
  });
}

function parseArgs(args) {
  const options = {
    sheet: 'Classification',
    dryRun: false,
    apply: false,
    limit: null,
    batchSize: 100,
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--apply') options.apply = true;
    else if (arg.startsWith('--file=')) options.file = path.resolve(process.cwd(), arg.slice('--file='.length));
    else if (arg.startsWith('--sheet=')) options.sheet = arg.slice('--sheet='.length).trim();
    else if (arg.startsWith('--tenant-id=')) options.tenantId = arg.slice('--tenant-id='.length).trim();
    else if (arg.startsWith('--tenant-code=')) options.tenantCode = arg.slice('--tenant-code='.length).trim();
    else if (arg.startsWith('--site-id=')) options.siteId = arg.slice('--site-id='.length).trim();
    else if (arg.startsWith('--site-code=')) options.siteCode = arg.slice('--site-code='.length).trim();
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--batch-size=')) options.batchSize = Number(arg.slice('--batch-size='.length));
    else if (arg === '--help') usage(0);
    else throw new Error(`UNKNOWN_ARGUMENT ${arg}`);
  }

  return options;
}

function validateOptions(options) {
  if (!options.file) throw new Error('FILE_REQUIRED: use --file=path/to/catalog.xlsx');
  if (!fs.existsSync(options.file)) throw new Error(`FILE_NOT_FOUND ${options.file}`);
  if (!options.tenantId && !options.tenantCode) throw new Error('TENANT_REQUIRED: use --tenant-id or --tenant-code');
  if (!options.siteId && !options.siteCode) throw new Error('SITE_REQUIRED: use --site-id or --site-code');
  if (options.dryRun === options.apply) throw new Error('MODE_REQUIRED: choose exactly one of --dry-run or --apply');
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit <= 0)) throw new Error('LIMIT_INVALID');
  if (![100, 250].includes(options.batchSize)) throw new Error('BATCH_SIZE_INVALID: use 100 or 250');
}

function usage(exitCode) {
  console.log([
    'Usage:',
    '  npm run import:catalog -- --file=./catalog.xlsx --tenant-code=DEMO --site-code=DEMO-SITE --dry-run',
    '  npm run import:catalog -- --file=./catalog.xlsx --tenant-code=DEMO --site-code=DEMO-SITE --limit=10 --apply',
  ].join('\n'));
  process.exit(exitCode);
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function withPool(work) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

function readWorkbook(file, sheetName) {
  const workbook = XLSX.readFile(file, { cellDates: false, raw: true });
  const resolvedSheetName = workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[resolvedSheetName];
  if (!worksheet) {
    throw new Error(`SHEET_NOT_FOUND ${sheetName}. Available: ${workbook.SheetNames.join(', ')}`);
  }
  const matrix = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true, header: 1 });
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex === -1) {
    throw new Error(`HEADER_ROW_NOT_FOUND ${resolvedSheetName}`);
  }
  const headers = matrix[headerIndex].map((value) => normalizeHeader(value));
  return matrix.slice(headerIndex + 1)
    .map((values, index) => {
      const row = {};
      headers.forEach((header, columnIndex) => {
        if (header) row[header] = values[columnIndex] ?? null;
      });
      row.__sourceRow = headerIndex + index + 2;
      return row;
    })
    .filter((row) => Object.entries(row).some(([key, value]) => key !== '__sourceRow' && cleanText(value) !== null));
}

function normalizeRows(rows, limit) {
  return rows.slice(0, limit ?? rows.length).map((row, index) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === '__sourceRow') continue;
      normalized[normalizeHeader(key)] = value;
    }
    return {
      sourceRow: row.__sourceRow ?? index + 2,
      code: cleanText(pick(normalized, ['code article', 'articles', 'article_code', 'code'])),
      name: cleanText(pick(normalized, ['produit', 'libelle', 'libellé', 'commercial_name', 'nom'])),
      rawExpiry: null,
      expiryDate: null,
      quantity: 0,
      categoryName: cleanText(pick(normalized, ['categorie pharmaceutique', 'catégorie pharmaceutique', 'category'])),
      subCategoryName: cleanText(pick(normalized, ['sous-categorie', 'sous-catégorie', 'sub_category'])),
      formName: cleanText(pick(normalized, ['forme galenique / type', 'forme galénique / type', 'forme galenique', 'type'])),
      confidence: cleanText(pick(normalized, ['confiance', 'confidence'])),
      validationStatus: cleanText(pick(normalized, ['statut validation', 'validation_status'])),
    };
  });
}

function validateRows(rows) {
  const codeCounts = new Map();
  for (const row of rows) {
    if (row.code) codeCounts.set(row.code, (codeCounts.get(row.code) ?? 0) + 1);
  }

  const duplicateCodes = [...codeCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
  const duplicateSet = new Set(duplicateCodes);
  const validRows = [];
  const invalidRows = [];

  for (const row of rows) {
    const errors = [];
    if (!row.code) errors.push('CODE_REQUIRED');
    if (!row.name) errors.push('NAME_REQUIRED');
    if (duplicateSet.has(row.code)) errors.push('DUPLICATE_CODE');

    const prepared = {
      ...row,
      expiryDate: null,
      quantity: 0,
      errors,
    };

    if (errors.length) invalidRows.push(prepared);
    else validRows.push(prepared);
  }

  return { sourceRows: rows.length, validRows, invalidRows, duplicateCodes };
}

async function resolveContext(pool, options) {
  const tenantResult = await pool.query(
    `SELECT tenant_id, tenant_code, tenant_name FROM tenants
     WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
       AND ($2::text IS NULL OR tenant_code = $2)
     LIMIT 1`,
    [options.tenantId ?? null, options.tenantCode ?? null],
  );
  const tenant = tenantResult.rows[0];
  if (!tenant) throw new Error('TENANT_NOT_FOUND');

  const siteResult = await pool.query(
    `SELECT site_id, site_code, site_name FROM sites
     WHERE tenant_id = $1
       AND ($2::uuid IS NULL OR site_id = $2::uuid)
       AND ($3::text IS NULL OR site_code = $3)
     LIMIT 1`,
    [tenant.tenant_id, options.siteId ?? null, options.siteCode ?? null],
  );
  const site = siteResult.rows[0];
  if (!site) throw new Error('SITE_NOT_FOUND_IN_TENANT');

  return { tenant, site };
}

async function auditSchema(pool) {
  const tableNames = [
    'articles',
    'categories',
    'sub_categories',
    'galenic_forms',
    'product_types',
    'lots',
    'stocks',
    'stock_movements',
    'tenants',
    'sites',
  ];
  const result = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name, ordinal_position`,
    [tableNames],
  );
  const columns = result.rows.reduce((acc, row) => {
    acc[row.table_name] = acc[row.table_name] ?? [];
    acc[row.table_name].push(row.column_name);
    return acc;
  }, {});
  const uniqueResult = await pool.query(
    `SELECT i.relname AS index_name, t.relname AS table_name, pg_get_indexdef(ix.indexrelid) AS definition
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND ix.indisunique AND t.relname = ANY($1::text[])
     ORDER BY t.relname, i.relname`,
    [tableNames],
  );
  return { columns, uniqueIndexes: uniqueResult.rows };
}

async function planImport(pool, context, rows, batchSize) {
  const categoryCache = await preloadByName(pool, 'categories', 'category_id', 'category_name', context.tenant.tenant_id);
  const subCategoryCache = await preloadSubCategories(pool, context.tenant.tenant_id);
  const formCache = await preloadByName(pool, 'galenic_forms', 'form_id', 'form_name', context.tenant.tenant_id);
  const articles = await preloadArticles(pool, context.tenant.tenant_id, rows.map((row) => row.code));
  const stockByArticle = await preloadStockByArticle(pool, context.tenant.tenant_id, context.site.site_id, rows.map((row) => row.code));

  const plan = {
    categoriesToCreate: [],
    subCategoriesToCreate: [],
    formsToCreate: [],
    productsToCreate: [],
    productsToUpdate: [],
    productsToSkip: [],
    openingLotsToCreate: [],
    openingStockQtyTotal: 0,
    skipOpeningStock: [],
    warnings: [],
  };

  const plannedCategories = new Map(categoryCache);
  const plannedSubCategories = new Map(subCategoryCache);
  const plannedForms = new Map(formCache);

  for (const row of rows) {
    let category = null;
    let categoryKey = null;
    if (row.categoryName) {
      categoryKey = normalizeKey(row.categoryName);
      category = plannedCategories.get(categoryKey);
      if (!category) {
        category = {
          categoryId: null,
          categoryCode: deterministicCode('CAT', row.categoryName),
          categoryName: row.categoryName,
        };
        plannedCategories.set(categoryKey, category);
        plan.categoriesToCreate.push(category);
      }
    }

    let subCategory = null;
    if (row.subCategoryName && categoryKey) {
      const subKey = `${categoryKey}::${normalizeKey(row.subCategoryName)}`;
      subCategory = plannedSubCategories.get(subKey);
      if (!subCategory) {
        subCategory = {
          subCategoryId: null,
          categoryKey,
          subCategoryCode: deterministicCode('SUB', `${row.categoryName}:${row.subCategoryName}`),
          subCategoryName: row.subCategoryName,
        };
        plannedSubCategories.set(subKey, subCategory);
        plan.subCategoriesToCreate.push(subCategory);
      }
    }

    let form = null;
    if (row.formName) {
      const formKey = normalizeKey(row.formName);
      form = plannedForms.get(formKey);
      if (!form) {
        form = {
          formId: null,
          formCode: deterministicCode('FRM', row.formName),
          formName: row.formName,
        };
        plannedForms.set(formKey, form);
        plan.formsToCreate.push(form);
      }
    }

    const existingArticle = articles.get(row.code);
    if (existingArticle) {
      const diffs = articleDiffs(existingArticle, row);
      if (diffs.length) {
        plan.productsToSkip.push({ row, article: existingArticle, reason: 'ARTICLE_EXISTS_WITH_DIFFERENCES', diffs });
        plan.warnings.push({ code: row.code, warning: 'ARTICLE_EXISTS_WITH_DIFFERENCES', diffs });
      } else {
        plan.productsToSkip.push({ row, article: existingArticle, reason: 'ARTICLE_EXISTS_NO_CHANGE' });
      }
    } else {
      plan.productsToCreate.push({ row, category, subCategory, form });
    }

    void stockByArticle;
  }

  plan.batchSize = batchSize;
  return plan;
}

async function applyImport(pool, context, plan, batchSize) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const refs = {
      categories: await preloadByName(client, 'categories', 'category_id', 'category_name', context.tenant.tenant_id),
      subCategories: await preloadSubCategories(client, context.tenant.tenant_id),
      forms: await preloadByName(client, 'galenic_forms', 'form_id', 'form_name', context.tenant.tenant_id),
    };

    for (const batch of chunks(plan.productsToCreate, batchSize)) {
      for (const item of batch) {
        const categoryId = item.category ? await ensureCategory(client, context, refs.categories, item.category) : null;
        const subCategoryId = item.subCategory ? await ensureSubCategory(client, context, refs.subCategories, item.subCategory, categoryId) : null;
        const formId = item.form ? await ensureForm(client, context, refs.forms, item.form) : null;
        await ensureArticle(client, context, item.row, categoryId, subCategoryId, formId);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureCategory(client, context, cache, category) {
  const key = normalizeKey(category.categoryName);
  const cached = cache.get(key);
  if (cached?.categoryId) return cached.categoryId;
  const result = await client.query(
    `INSERT INTO categories (tenant_id, category_code, category_name, description, is_active)
     VALUES ($1,$2,$3,'Import catalogue initial',true)
     ON CONFLICT (category_code) DO UPDATE SET category_name = EXCLUDED.category_name
     RETURNING category_id`,
    [context.tenant.tenant_id, category.categoryCode, category.categoryName],
  );
  const categoryId = result.rows[0].category_id;
  cache.set(key, { ...category, categoryId });
  return categoryId;
}

async function ensureSubCategory(client, context, cache, subCategory, categoryId) {
  const key = `${subCategory.categoryKey}::${normalizeKey(subCategory.subCategoryName)}`;
  const cached = cache.get(key);
  if (cached?.subCategoryId) return cached.subCategoryId;
  const result = await client.query(
    `INSERT INTO sub_categories (tenant_id, category_id, sub_category_code, sub_category_name, description, is_active)
     VALUES ($1,$2,$3,$4,'Import catalogue initial',true)
     ON CONFLICT (category_id, sub_category_code) DO UPDATE SET sub_category_name = EXCLUDED.sub_category_name
     RETURNING sub_category_id`,
    [context.tenant.tenant_id, categoryId, subCategory.subCategoryCode, subCategory.subCategoryName],
  );
  const subCategoryId = result.rows[0].sub_category_id;
  cache.set(key, { ...subCategory, subCategoryId });
  return subCategoryId;
}

async function ensureForm(client, context, cache, form) {
  const key = normalizeKey(form.formName);
  const cached = cache.get(key);
  if (cached?.formId) return cached.formId;
  const result = await client.query(
    `INSERT INTO galenic_forms (tenant_id, form_code, form_name)
     VALUES ($1,$2,$3)
     ON CONFLICT (form_code) DO UPDATE SET form_name = EXCLUDED.form_name
     RETURNING form_id`,
    [context.tenant.tenant_id, form.formCode, form.formName],
  );
  const formId = result.rows[0].form_id;
  cache.set(key, { ...form, formId });
  return formId;
}

async function ensureArticle(client, context, row, categoryId, subCategoryId, formId) {
  const current = await client.query(
    `SELECT article_id FROM articles WHERE tenant_id = $1 AND article_code = $2 LIMIT 1`,
    [context.tenant.tenant_id, row.code],
  );
  if (current.rows[0]) return current.rows[0].article_id;
  const result = await client.query(
    `INSERT INTO articles (
       tenant_id, article_code, commercial_name, category_id, sub_category_id,
       form_id, packaging, default_stock_min, is_active
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,true)
     RETURNING article_id`,
    [context.tenant.tenant_id, row.code, row.name, categoryId, subCategoryId, formId, row.formName || null],
  );
  return result.rows[0].article_id;
}

async function ensureOpeningStock(client, context, articleId, item) {
  const existingStock = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM stocks st
     JOIN lots l ON l.lot_id = st.lot_id AND l.tenant_id = st.tenant_id
     WHERE st.tenant_id = $1 AND st.site_id = $2 AND l.article_id = $3`,
    [context.tenant.tenant_id, context.site.site_id, articleId],
  );
  if (Number(existingStock.rows[0]?.total ?? 0) > 0) return;

  const lotResult = await client.query(
    `INSERT INTO lots (
       tenant_id, article_id, lot_number, expiry_date, purchase_price, selling_price, is_blocked, block_reason
     )
     VALUES ($1,$2,$3,$4,0,0,$5,$6)
     ON CONFLICT (article_id, lot_number) DO UPDATE
     SET expiry_date = EXCLUDED.expiry_date
     RETURNING lot_id`,
    [
      context.tenant.tenant_id,
      articleId,
      item.lotNumber,
      item.row.expiryDate,
      isExpired(item.row.expiryDate),
      isExpired(item.row.expiryDate) ? 'Import stock initial: lot expire' : null,
    ],
  );
  const lotId = lotResult.rows[0].lot_id;
  await client.query(
    `INSERT INTO stocks (tenant_id, site_id, lot_id, quantity_available, quantity_reserved)
     VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (site_id, lot_id) DO NOTHING`,
    [context.tenant.tenant_id, context.site.site_id, lotId, item.row.quantity],
  );
  await client.query(
    `INSERT INTO stock_movements (
       tenant_id, site_id, article_id, lot_id, movement_type, quantity, reference_type, notes
     )
     SELECT $1,$2,$3,$4,'INVENTORY_GAIN',$5,'CATALOG_IMPORT_OPENING',$6
     WHERE NOT EXISTS (
       SELECT 1 FROM stock_movements
       WHERE tenant_id = $1 AND site_id = $2 AND article_id = $3 AND lot_id = $4
         AND movement_type = 'INVENTORY_GAIN' AND reference_type = 'CATALOG_IMPORT_OPENING'
     )`,
    [
      context.tenant.tenant_id,
      context.site.site_id,
      articleId,
      lotId,
      item.row.quantity,
      `Stock initial catalogue ${item.row.code} ${item.lotNumber}`,
    ],
  );
}

async function preloadByName(client, table, idColumn, nameColumn, tenantId) {
  const result = await client.query(
    `SELECT ${idColumn} AS id, ${nameColumn} AS name FROM ${table} WHERE tenant_id = $1`,
    [tenantId],
  );
  return new Map(result.rows.map((row) => [normalizeKey(row.name), { [`${camel(idColumn)}`]: row.id, [`${camel(nameColumn)}`]: row.name }]));
}

async function preloadSubCategories(client, tenantId) {
  const result = await client.query(
    `SELECT sc.sub_category_id, sc.sub_category_name, c.category_name
     FROM sub_categories sc
     JOIN categories c ON c.category_id = sc.category_id AND c.tenant_id = sc.tenant_id
     WHERE sc.tenant_id = $1`,
    [tenantId],
  );
  return new Map(result.rows.map((row) => [
    `${normalizeKey(row.category_name)}::${normalizeKey(row.sub_category_name)}`,
    { subCategoryId: row.sub_category_id, subCategoryName: row.sub_category_name },
  ]));
}

async function preloadArticles(pool, tenantId, codes) {
  if (!codes.length) return new Map();
  const result = await pool.query(
    `SELECT article_id, article_code, commercial_name, category_id, sub_category_id, form_id, packaging
     FROM articles WHERE tenant_id = $1 AND article_code = ANY($2::text[])`,
    [tenantId, codes],
  );
  return new Map(result.rows.map((row) => [row.article_code, row]));
}

async function preloadStockByArticle(pool, tenantId, siteId, codes) {
  if (!codes.length) return new Map();
  const result = await pool.query(
    `SELECT a.article_code, COUNT(st.stock_id)::int AS stock_count, COALESCE(SUM(st.quantity_available),0)::numeric AS quantity_available
     FROM articles a
     JOIN lots l ON l.article_id = a.article_id AND l.tenant_id = a.tenant_id
     JOIN stocks st ON st.lot_id = l.lot_id AND st.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1 AND st.site_id = $2 AND a.article_code = ANY($3::text[])
     GROUP BY a.article_code`,
    [tenantId, siteId, codes],
  );
  return new Map(result.rows.map((row) => [row.article_code, row]));
}

function buildReport(audit, context, validation, plan, options) {
  const expiredWithStock = validation.validRows.filter((row) => row.quantity > 0 && isExpired(row.expiryDate));
  const missingExpiryWithStock = validation.invalidRows.filter((row) => row.errors.includes('MISSING_EXPIRY_WITH_STOCK'));
  const invalidExpiryWithStock = validation.invalidRows.filter((row) => row.errors.includes('EXPIRY_DATE_INVALID') && row.quantity > 0);
  const statusCounts = countClassificationStatuses([...validation.validRows, ...validation.invalidRows]);
  const existingExact = plan.productsToSkip.filter((item) => item.reason === 'ARTICLE_EXISTS_NO_CHANGE').length;
  const existingDifferent = plan.productsToSkip.filter((item) => item.reason === 'ARTICLE_EXISTS_WITH_DIFFERENCES').length;
  const duplicateDetails = duplicateCodeDetails([...validation.validRows, ...validation.invalidRows], validation.duplicateCodes);
  const stockRows = validation.validRows.filter((row) => row.quantity > 0);
  const independentStockTotal = plan.openingLotsToCreate.reduce((total, item) => total + item.row.quantity, 0);
  return {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'APPLY' : 'DRY_RUN',
    databaseModified: false,
    source: { file: options.file, sheet: options.sheet, limit: options.limit },
    context: {
      tenantId: context.tenant.tenant_id,
      tenantCode: context.tenant.tenant_code,
      siteId: context.site.site_id,
      siteCode: context.site.site_code,
    },
    audit,
    metrics: {
      SOURCE_ROWS: validation.sourceRows,
      VALID_ROWS: validation.validRows.length,
      INVALID_ROWS: validation.invalidRows.length,
      UNIQUE_PRODUCTS: new Set(validation.validRows.map((row) => row.code)).size,
      DUPLICATE_CODES: validation.duplicateCodes.length,
      CATEGORIES_FOUND: new Set(validation.validRows.map((row) => row.categoryName).filter(Boolean).map(normalizeKey)).size,
      SUBCATEGORIES_FOUND: new Set(validation.validRows.map((row) => row.subCategoryName).filter(Boolean).map(normalizeKey)).size,
      PRODUCTS_TO_CREATE: plan.productsToCreate.length,
      PRODUCTS_TO_UPDATE: plan.productsToUpdate.length,
      PRODUCTS_TO_SKIP: plan.productsToSkip.length,
      NEW_PRODUCTS: plan.productsToCreate.length,
      EXISTING_EXACT_MATCH: existingExact,
      EXISTING_DIFFERENT: existingDifferent,
      CATEGORIES_TO_CREATE: plan.categoriesToCreate.length,
      SUBCATEGORIES_TO_CREATE: plan.subCategoriesToCreate.length,
      OPENING_LOTS_TO_CREATE: plan.openingLotsToCreate.length,
      OPENING_STOCK_QTY_TOTAL: Number(plan.openingStockQtyTotal.toFixed(3)),
      OPENING_STOCK_QTY_TOTAL_CROSSCHECK: Number(independentStockTotal.toFixed(3)),
      STOCK_TOTAL_CROSSCHECK: Math.abs(independentStockTotal - plan.openingStockQtyTotal) < 0.0001 ? 'PASS' : 'FAIL',
      ZERO_STOCK_PRODUCTS: validation.validRows.filter((row) => row.quantity === 0).length,
      PRODUCTS_WITH_STOCK: stockRows.length,
      EXPIRED_LOTS_WITH_STOCK: expiredWithStock.length,
      MISSING_EXPIRY_WITH_STOCK: missingExpiryWithStock.length,
      INVALID_EXPIRY_WITH_STOCK: invalidExpiryWithStock.length,
      CLASSIFICATION_OK_AUTOMATIC: statusCounts.okAutomatic,
      CLASSIFICATION_TO_CONTROL: statusCounts.toControl,
      CLASSIFICATION_MANUAL_VALIDATION: statusCounts.manualValidation,
      SKIP_OPENING_STOCK: plan.skipOpeningStock.length,
    },
    duplicateCodes: duplicateDetails,
    invalidRows: validation.invalidRows,
    warnings: plan.warnings,
    samples: {
      stockRows: plan.openingLotsToCreate.slice(0, 10).map((item) => ({
        code: item.row.code,
        product: item.row.name,
        sourceQty: item.row.quantity,
        sourceExpiry: item.row.rawExpiry,
        parsedExpiry: item.row.expiryDate,
        plannedLotNumber: item.lotNumber,
        plannedMovementType: 'INVENTORY_GAIN',
        plannedMovementQty: item.row.quantity,
      })),
      excelSerialDates: validation.validRows
        .filter((row) => typeof row.rawExpiry === 'number')
        .slice(0, 10)
        .map((row) => ({ rawValue: row.rawExpiry, parsedDate: row.expiryDate, code: row.code })),
    },
    idempotenceReview: {
      productKey: 'tenant_id + article_code',
      lotKey: 'article_id + lot_number',
      movementGuard: "tenant_id + site_id + article_id + lot_id + movement_type='INVENTORY_GAIN' + reference_type='CATALOG_IMPORT_OPENING'",
      secondRunExpectedAdditionalQuantity: 0,
    },
    createdReferencesPreview: {
      categories: plan.categoriesToCreate,
      subCategories: plan.subCategoriesToCreate,
      galenicForms: plan.formsToCreate,
    },
  };
}

async function writeReport(report) {
  await fs.promises.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.promises.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
}

function printSummary(report) {
  console.log(JSON.stringify({
    reportPath: REPORT_PATH,
    mode: report.mode,
    databaseModified: report.databaseModified,
    metrics: report.metrics,
  }, null, 2));
}

function normalizeHeader(value) {
  return stripAccents(String(value ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');
}

function findHeaderRow(matrix) {
  return matrix.findIndex((row) => {
    const headers = row.map((value) => normalizeHeader(value));
    const hasCode = headers.some((header) => ['code article', 'articles', 'article_code', 'code'].includes(header));
    const hasName = headers.some((header) => ['produit', 'libelle', 'commercial_name', 'nom'].includes(header));
    return hasCode && hasName;
  });
}

function pick(row, keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    if (Object.prototype.hasOwnProperty.call(row, normalized)) return row[normalized];
  }
  return null;
}

function cleanText(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text || null;
}

function parseQuantity(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? { invalid: true } : { value: toIsoDate(value) };
  if (typeof value === 'number') {
    if (value <= 0) return { value: null };
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return { invalid: true };
    return { value: toIsoDate(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))) };
  }
  const text = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return isValidDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? { value: text } : { invalid: true };
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    return isValidDate(year, month, day) ? { value: toIsoParts(year, month, day) } : { invalid: true };
  }
  return { invalid: true };
}

function toIsoDate(date) {
  return toIsoParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function toIsoParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isExpired(isoDate) {
  if (!isoDate) return false;
  const today = new Date();
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) <= current;
}

function deterministicCode(prefix, value) {
  const hash = crypto.createHash('sha1').update(stripAccents(String(value)).toUpperCase()).digest('hex').slice(0, 6).toUpperCase();
  const slug = stripAccents(String(value)).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'REF';
  return `${prefix}-${slug}-${hash}`.slice(0, 30);
}

function openingLotNumber(code, expiryDate) {
  return `OPENING-${code}-${expiryDate}`;
}

function normalizeKey(value) {
  return stripAccents(String(value ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');
}

function stripAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function camel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function articleDiffs(article, row) {
  const diffs = [];
  if (cleanText(article.commercial_name) !== row.name) diffs.push('commercial_name');
  if (cleanText(article.packaging) !== (row.formName ?? null)) diffs.push('packaging');
  return diffs;
}

function duplicateCodeDetails(rows, duplicateCodes) {
  const byCode = new Map();
  for (const row of rows) {
    if (!duplicateCodes.includes(row.code)) continue;
    if (!byCode.has(row.code)) byCode.set(row.code, []);
    byCode.get(row.code).push(row.sourceRow);
  }
  return [...byCode.entries()].map(([code, lines]) => ({ code, lines }));
}

function countClassificationStatuses(rows) {
  const result = { okAutomatic: 0, toControl: 0, manualValidation: 0 };
  for (const row of rows) {
    const status = normalizeKey(row.validationStatus);
    if (status === normalizeKey('OK automatique')) result.okAutomatic += 1;
    else if (status === normalizeKey('A controler')) result.toControl += 1;
    else if (status === normalizeKey('A valider manuellement')) result.manualValidation += 1;
  }
  return result;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

main().catch(async (error) => {
  const failure = {
    generatedAt: new Date().toISOString(),
    mode: 'FAILED',
    databaseModified: false,
    error: serializeFailure(error),
  };
  try {
    await writeReport(failure);
  } catch {
    // Ignore secondary report write errors.
  }
  console.error(failure.error);
  process.exit(1);
});

function serializeFailure(error) {
  if (!(error instanceof Error)) return String(error);
  const details = {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
  };
  if (Array.isArray(error.errors)) {
    details.errors = error.errors.map((entry) => serializeFailure(entry));
  }
  return JSON.stringify(details, null, 2);
}
