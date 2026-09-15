#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FILE = path.join(ROOT, 'tmp', 'Produits_categorises_codes_categorie_souscategorie.xlsx');
const EXCLUDED_CODES = [
  'DER-CPD-01018',
  'VAL-LIP-01341',
  'VAL-LIP-01457',
  'VAL-LIP-02413',
  'VAL-LIP-02478',
  'VAL-LIP-02479',
  'VAL-LIP-02653',
  'AAI-PAA-03300',
  'NIU-LIN-03916',
  'VAL-LIP-05057',
  'MPE-ICN-05177',
  'VAL-LIP-05524',
  'VCI-VMI-06122',
  'VAL-LIP-07009',
  'VAL-LIP-07062',
  'VAL-LIP-07086',
  'VAL-LIP-07414',
  'VAL-LIP-07415',
  'CTA-HYP-08097',
  'OPH-CPO-08946',
];
const PILOT_CODES = [
  'DER-CPD-00001',
  'DMC-SER-00002',
  'DMC-SER-00003',
  'DMC-SER-00004',
  'DES-DAC-00005',
  'PAL-ACR-00006',
  'PAL-ACR-00007',
  'MPE-CGC-00008',
  'PAL-ACR-00009',
  'PAL-ACR-00010',
];

async function main() {
  loadEnv(path.join(ROOT, '.env'));
  const options = parseArgs(process.argv.slice(2));
  const workbook = readWorkbook(options.file);
  const pool = await openPool();
  try {
    const context = await resolveContext(pool, options);
    const before = await planImport(pool, context, workbook, options);
    printPlan(before, options.apply ? 'PRE_APPLY' : 'DRY_RUN');
    if (!before.readyToApply) {
      if (options.apply) throw new Error('ABORT_PRECONDITIONS_FAILED');
      return;
    }
    if (!options.apply) return;

    const applyResult = await applyImport(pool, context, before);
    const after = await verifyAfterApply(pool, context, workbook, applyResult.beforePilotIds);
    console.log(JSON.stringify({ mode: 'POST_APPLY', ...applyResult, ...after }, null, 2));

    const secondBefore = await planImport(pool, context, workbook, { ...options, expectedExisting: workbook.finalRows.length, expectedCreate: 0 });
    const second = await applyImport(pool, context, secondBefore);
    const secondAfter = await verifyAfterApply(pool, context, workbook, applyResult.beforePilotIds);
    console.log(JSON.stringify({
      mode: 'SECOND_RUN',
      EXISTING_EXACT_MATCH_SECOND_RUN: secondBefore.existingExactMatch,
      PRODUCTS_CREATED_SECOND_RUN: second.productsCreated,
      PRODUCTS_UPDATED_SECOND_RUN: 0,
      CATEGORIES_CREATED_SECOND_RUN: second.categoriesCreated,
      SUBCATEGORIES_CREATED_SECOND_RUN: second.subCategoriesCreated,
      FORMS_CREATED_SECOND_RUN: second.formsCreated,
      LOTS_CREATED_SECOND_RUN: 0,
      MOVEMENTS_CREATED_SECOND_RUN: 0,
      STOCK_ADDED_SECOND_RUN: 0,
      SECOND_RUN_IDEMPOTENCE: (
        secondBefore.existingExactMatch === workbook.finalRows.length
        && second.productsCreated === 0
        && second.categoriesCreated === 0
        && second.subCategoriesCreated === 0
        && second.formsCreated === 0
        && secondAfter.ARTICLES_WITH_NONZERO_STOCK === 0
        && secondAfter.CATALOG_LOTS_CREATED === 0
        && secondAfter.CATALOG_STOCK_MOVEMENTS_CREATED === 0
      ) ? 'PASS' : 'FAIL',
    }, null, 2));
  } finally {
    await pool.end();
  }
}

function parseArgs(args) {
  const options = {
    file: DEFAULT_FILE,
    tenantCode: 'DEMO',
    siteCode: 'DEMO-SITE',
    apply: false,
    expectedExisting: 10,
    expectedCreate: 9383,
  };
  for (const arg of args) {
    if (arg === '--dry-run') options.apply = false;
    else if (arg === '--apply') options.apply = true;
    else if (arg.startsWith('--file=')) options.file = path.resolve(process.cwd(), arg.slice('--file='.length));
    else if (arg.startsWith('--tenant-code=')) options.tenantCode = arg.slice('--tenant-code='.length).trim();
    else if (arg.startsWith('--site-code=')) options.siteCode = arg.slice('--site-code='.length).trim();
    else if (arg.startsWith('--expected-existing=')) options.expectedExisting = Number(arg.slice('--expected-existing='.length));
    else if (arg.startsWith('--expected-create=')) options.expectedCreate = Number(arg.slice('--expected-create='.length));
    else throw new Error(`UNKNOWN_ARGUMENT ${arg}`);
  }
  if (!fs.existsSync(options.file)) throw new Error(`FILE_NOT_FOUND ${options.file}`);
  if (!Number.isInteger(options.expectedExisting) || options.expectedExisting < 0) throw new Error('EXPECTED_EXISTING_INVALID');
  if (!Number.isInteger(options.expectedCreate) || options.expectedCreate < 0) throw new Error('EXPECTED_CREATE_INVALID');
  return options;
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function openPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });
}

async function resolveContext(pool, options) {
  const tenant = (await pool.query(
    'SELECT tenant_id, tenant_code FROM tenants WHERE tenant_code = $1 LIMIT 1',
    [options.tenantCode],
  )).rows[0];
  if (!tenant) throw new Error('TENANT_NOT_FOUND');
  const site = (await pool.query(
    'SELECT site_id, site_code FROM sites WHERE tenant_id = $1 AND site_code = $2 LIMIT 1',
    [tenant.tenant_id, options.siteCode],
  )).rows[0];
  if (!site) throw new Error('SITE_NOT_FOUND');
  return { tenant, site };
}

function readWorkbook(file) {
  const workbook = XLSX.readFile(file, { raw: true, cellDates: false });
  const classificationSheet = workbook.SheetNames.find((name) => normalizeHeader(name) === 'classification');
  const referenceSheet = workbook.SheetNames.find((name) => normalizeHeader(name).includes('referentiel codes articles'));
  if (!classificationSheet || !referenceSheet) throw new Error(`REQUIRED_SHEETS_NOT_FOUND ${workbook.SheetNames.join(', ')}`);

  const refs = new Map();
  const refRows = toRows(workbook.Sheets[referenceSheet]);
  for (const row of refRows.rows) {
    const category = clean(row[refRows.index('categorie pharmaceutique')]);
    const subCategory = clean(row[refRows.index('sous-categorie')]);
    if (!category || !subCategory) continue;
    refs.set(`${key(category)}::${key(subCategory)}`, {
      category,
      subCategory,
      categoryCode: clean(row[refRows.index('code categorie')]),
      subCategoryCode: clean(row[refRows.index('code sous-categorie')]),
    });
  }

  const excluded = new Set(EXCLUDED_CODES);
  const sourceRows = [];
  const importRows = [];
  const classRows = toRows(workbook.Sheets[classificationSheet]);
  for (const [index, row] of classRows.rows.entries()) {
    const category = clean(row[classRows.index('categorie pharmaceutique')]);
    const subCategory = clean(row[classRows.index('sous-categorie')]);
    const ref = refs.get(`${key(category)}::${key(subCategory)}`);
    const item = {
      sourceRow: index + 2,
      articleCode: clean(row[classRows.index('code article')]),
      product: clean(row[classRows.index('produit')]),
      category,
      subCategory,
      form: clean(row[classRows.index('forme galenique / type')]),
      categoryCode: ref?.categoryCode ?? null,
      subCategoryCode: ref?.subCategoryCode ?? null,
    };
    if (!item.articleCode && !item.product) continue;
    sourceRows.push(item);
    if (!excluded.has(item.articleCode)) importRows.push(item);
  }

  return { sourceRows, finalRows: importRows, excludedCodes: EXCLUDED_CODES };
}

function toRows(ws) {
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = matrix[0].map(normalizeHeader);
  return {
    rows: matrix.slice(1),
    index(name) {
      return headers.indexOf(normalizeHeader(name));
    },
  };
}

async function planImport(pool, context, workbook, options) {
  const rows = workbook.finalRows;
  const codeCounts = countValues(rows.map((row) => row.articleCode));
  const duplicateCodes = [...codeCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
  const invalidRows = rows.filter((row) => !isValidStructured(row) || !row.product || !row.category || !row.subCategory || !row.form);

  const articles = await getArticles(pool, context, rows.map((row) => row.articleCode));
  const articlesByCode = new Map(articles.map((row) => [row.article_code, row]));
  const categories = await getCategories(pool, context);
  const categoryByCode = new Map(categories.map((row) => [row.category_code, row]));
  const subCategories = await getSubCategories(pool, context);
  const subByCategoryAndCode = new Map(subCategories.map((row) => [`${row.category_code}::${row.sub_category_code}`, row]));
  const forms = await getForms(pool, context);
  const formByCode = new Map(forms.map((row) => [row.form_code, row]));

  let existingExactMatch = 0;
  let existingDifferent = 0;
  const productsToCreate = [];
  const conflicts = [];
  const distinctCategories = new Map();
  const distinctSubCategories = new Map();
  const distinctForms = new Map();

  for (const row of rows) {
    distinctCategories.set(row.categoryCode, row);
    distinctSubCategories.set(`${row.categoryCode}::${row.subCategoryCode}`, row);
    distinctForms.set(formCode(row.form), row);
    const existing = articlesByCode.get(row.articleCode);
    if (!existing) {
      productsToCreate.push(row);
      continue;
    }
    if (articleMatches(existing, row)) existingExactMatch += 1;
    else {
      existingDifferent += 1;
      conflicts.push({ code: row.articleCode, product: row.product, existingProduct: existing.commercial_name });
    }
  }

  const categoriesToCreate = [...distinctCategories.values()].filter((row) => !categoryByCode.has(row.categoryCode));
  const subCategoriesToCreate = [...distinctSubCategories.values()].filter((row) => !subByCategoryAndCode.has(`${row.categoryCode}::${row.subCategoryCode}`));
  const formsToCreate = [...distinctForms.values()].filter((row) => !formByCode.has(formCode(row.form)));
  const pilotArticles = articles.filter((row) => PILOT_CODES.includes(row.article_code));
  const beforePilotIds = new Map(pilotArticles.map((row) => [row.article_code, row.article_id]));

  const readyToApply = (
    workbook.sourceRows.length === 9413
    && workbook.excludedCodes.length === 20
    && rows.length === 9393
    && duplicateCodes.length === 0
    && invalidRows.length === 0
    && existingExactMatch === options.expectedExisting
    && productsToCreate.length === options.expectedCreate
    && existingDifferent === 0
    && conflicts.length === 0
    && pilotArticles.length === Math.min(options.expectedExisting, PILOT_CODES.length)
  );

  return {
    readyToApply,
    beforePilotIds,
    sourceRows: workbook.sourceRows.length,
    excludedDuplicateRows: workbook.excludedCodes.length,
    finalRows: rows.length,
    duplicateCodes,
    invalidRows,
    existingExactMatch,
    productsToCreate,
    existingDifferent,
    conflicts,
    categoriesToCreate,
    subCategoriesToCreate,
    formsToCreate,
    allRows: rows,
  };
}

async function applyImport(pool, context, plan) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let categoriesCreated = 0;
    let subCategoriesCreated = 0;
    let formsCreated = 0;
    let productsCreated = 0;
    const categoryIds = new Map();
    const subCategoryIds = new Map();
    const formIds = new Map();

    const categoryRows = uniqueBy(plan.allRows, (row) => row.categoryCode);
    const subCategoryRows = uniqueBy(plan.allRows, (row) => `${row.categoryCode}::${row.subCategoryCode}`);
    const formRows = uniqueBy(plan.allRows, (row) => formCode(row.form));

    for (const row of categoryRows) {
      const category = await ensureCategory(client, context, row);
      if (category.created) categoriesCreated += 1;
      categoryIds.set(row.categoryCode, category.id);
    }

    for (const row of subCategoryRows) {
      const subCategory = await ensureSubCategory(client, context, row, categoryIds.get(row.categoryCode));
      if (subCategory.created) subCategoriesCreated += 1;
      subCategoryIds.set(`${row.categoryCode}::${row.subCategoryCode}`, subCategory.id);
    }

    for (const row of formRows) {
      const form = await ensureForm(client, context, row);
      if (form.created) formsCreated += 1;
      formIds.set(formCode(row.form), form.id);
    }

    for (const batch of chunks(plan.productsToCreate, 500)) {
      const values = [];
      const placeholders = [];
      for (const row of batch) {
        const offset = values.length;
        values.push(
          context.tenant.tenant_id,
          row.articleCode,
          row.product,
          categoryIds.get(row.categoryCode),
          subCategoryIds.get(`${row.categoryCode}::${row.subCategoryCode}`),
          formIds.get(formCode(row.form)),
          row.form,
        );
        placeholders.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},0,true)`);
      }
      const result = await client.query(
        `INSERT INTO articles (
           tenant_id, article_code, commercial_name, category_id, sub_category_id,
           form_id, packaging, default_stock_min, is_active
         )
         VALUES ${placeholders.join(',')}
         ON CONFLICT (tenant_id, article_code) DO NOTHING
         RETURNING article_id`,
        values,
      );
      productsCreated += result.rowCount;
    }
    await client.query('COMMIT');
    return {
      productsCreated,
      categoriesCreated,
      subCategoriesCreated,
      formsCreated,
      beforePilotIds: plan.beforePilotIds,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function verifyAfterApply(pool, context, workbook, beforePilotIds) {
  const codes = workbook.finalRows.map((row) => row.articleCode);
  const articles = await getArticles(pool, context, codes);
  const foundCodes = new Set(articles.map((row) => row.article_code));
  const duplicateDb = (await pool.query(
    `SELECT article_code, COUNT(*)::int AS total
     FROM articles
     WHERE tenant_id = $1 AND article_code = ANY($2::text[])
     GROUP BY article_code
     HAVING COUNT(*) > 1`,
    [context.tenant.tenant_id, codes],
  )).rows;
  const excluded = (await pool.query(
    `SELECT article_code FROM articles WHERE tenant_id = $1 AND article_code = ANY($2::text[]) ORDER BY article_code`,
    [context.tenant.tenant_id, EXCLUDED_CODES],
  )).rows;
  const stockRows = (await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM articles a
     JOIN lots l ON l.tenant_id = a.tenant_id AND l.article_id = a.article_id
     JOIN stocks st ON st.tenant_id = a.tenant_id AND st.lot_id = l.lot_id
     WHERE a.tenant_id = $1 AND a.article_code = ANY($2::text[]) AND st.quantity_available <> 0`,
    [context.tenant.tenant_id, codes],
  )).rows[0];
  const lotRows = (await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM articles a
     JOIN lots l ON l.tenant_id = a.tenant_id AND l.article_id = a.article_id
     WHERE a.tenant_id = $1 AND a.article_code = ANY($2::text[])`,
    [context.tenant.tenant_id, codes],
  )).rows[0];
  const movementRows = (await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM articles a
     JOIN stock_movements sm ON sm.tenant_id = a.tenant_id AND sm.article_id = a.article_id
     WHERE a.tenant_id = $1 AND a.article_code = ANY($2::text[])`,
    [context.tenant.tenant_id, codes],
  )).rows[0];
  const pilotAfter = await getArticles(pool, context, PILOT_CODES);
  const pilotArticleIdsPreserved = PILOT_CODES.every((code) => beforePilotIds.get(code) === pilotAfter.find((row) => row.article_code === code)?.article_id);

  return {
    CATALOG_ARTICLES_FOUND: codes.filter((code) => foundCodes.has(code)).length,
    STRUCTURED_CODES_FOUND: articles.filter((row) => /^[A-Z]{2,5}-[A-Z0-9]{2,5}-\d{5}$/.test(row.article_code)).length,
    DUPLICATE_ARTICLE_CODES_DB: duplicateDb.length,
    EXCLUDED_CODES_FOUND_IN_DB: excluded.length,
    DER_CPD_01018: excluded.some((row) => row.article_code === 'DER-CPD-01018') ? 'FOUND' : 'NOT_FOUND',
    ARTICLES_WITH_NONZERO_STOCK: Number(stockRows.total),
    CATALOG_LOTS_CREATED: Number(lotRows.total),
    CATALOG_STOCK_MOVEMENTS_CREATED: Number(movementRows.total),
    PILOT_ARTICLE_IDS_PRESERVED: pilotArticleIdsPreserved ? 'YES' : 'NO',
    samples: sampleRows(articles, [
      'DER-CPD-00001',
      'DMC-SER-00002',
      'DES-DAC-00005',
      'PAL-ACR-00009',
      'AAI-PAA-03299',
      'NIU-LIN-03915',
      'MPE-ICN-05176',
      'VCI-VMI-06121',
      'CTA-HYP-08096',
      'OPH-CPO-08945',
    ]),
  };
}

function sampleRows(articles, sampleCodes) {
  const byCode = new Map(articles.map((row) => [row.article_code, row]));
  return sampleCodes.map((code) => {
    const row = byCode.get(code);
    return {
      ARTICLE_ID: row?.article_id ?? null,
      ARTICLE_CODE: code,
      PRODUCT: row?.commercial_name ?? null,
      CATEGORY: row?.category_name ?? null,
      SUBCATEGORY: row?.sub_category_name ?? null,
      FORM: row?.form_name ?? null,
      STOCK: Number(row?.stock ?? 0),
      LOT_COUNT: Number(row?.lots ?? 0),
      MOVEMENT_COUNT: Number(row?.movements ?? 0),
    };
  });
}

async function ensureCategory(client, context, row) {
  const existing = (await client.query(
    'SELECT category_id FROM categories WHERE tenant_id = $1 AND category_code = $2 LIMIT 1',
    [context.tenant.tenant_id, row.categoryCode],
  )).rows[0];
  if (existing) return { id: existing.category_id, created: false };
  const result = await client.query(
    `INSERT INTO categories (tenant_id, category_code, category_name, description, is_active)
     VALUES ($1,$2,$3,'Import catalogue classifie',true)
     RETURNING category_id`,
    [context.tenant.tenant_id, row.categoryCode, row.category],
  );
  return { id: result.rows[0].category_id, created: true };
}

async function ensureSubCategory(client, context, row, categoryId) {
  const existing = (await client.query(
    'SELECT sub_category_id FROM sub_categories WHERE tenant_id = $1 AND category_id = $2 AND sub_category_code = $3 LIMIT 1',
    [context.tenant.tenant_id, categoryId, row.subCategoryCode],
  )).rows[0];
  if (existing) return { id: existing.sub_category_id, created: false };
  const result = await client.query(
    `INSERT INTO sub_categories (tenant_id, category_id, sub_category_code, sub_category_name, description, is_active)
     VALUES ($1,$2,$3,$4,'Import catalogue classifie',true)
     RETURNING sub_category_id`,
    [context.tenant.tenant_id, categoryId, row.subCategoryCode, row.subCategory],
  );
  return { id: result.rows[0].sub_category_id, created: true };
}

async function ensureForm(client, context, row) {
  const code = formCode(row.form);
  const existing = (await client.query(
    'SELECT form_id FROM galenic_forms WHERE tenant_id = $1 AND form_code = $2 LIMIT 1',
    [context.tenant.tenant_id, code],
  )).rows[0];
  if (existing) return { id: existing.form_id, created: false };
  const result = await client.query(
    `INSERT INTO galenic_forms (tenant_id, form_code, form_name) VALUES ($1,$2,$3) RETURNING form_id`,
    [context.tenant.tenant_id, code, row.form],
  );
  return { id: result.rows[0].form_id, created: true };
}

async function getArticles(pool, context, codes) {
  if (!codes.length) return [];
  return (await pool.query(
    `SELECT
       a.article_id, a.article_code, a.commercial_name, a.category_id, a.sub_category_id, a.form_id,
       c.category_code, c.category_name, sc.sub_category_code, sc.sub_category_name, gf.form_code, gf.form_name,
       COALESCE(SUM(st.quantity_available),0)::numeric AS stock,
       COUNT(DISTINCT l.lot_id)::int AS lots,
       COUNT(DISTINCT sm.movement_id)::int AS movements
     FROM articles a
     LEFT JOIN categories c ON c.category_id = a.category_id AND c.tenant_id = a.tenant_id
     LEFT JOIN sub_categories sc ON sc.sub_category_id = a.sub_category_id AND sc.tenant_id = a.tenant_id
     LEFT JOIN galenic_forms gf ON gf.form_id = a.form_id AND gf.tenant_id = a.tenant_id
     LEFT JOIN lots l ON l.article_id = a.article_id AND l.tenant_id = a.tenant_id
     LEFT JOIN stocks st ON st.lot_id = l.lot_id AND st.tenant_id = a.tenant_id
     LEFT JOIN stock_movements sm ON sm.article_id = a.article_id AND sm.tenant_id = a.tenant_id
     WHERE a.tenant_id = $1 AND a.article_code = ANY($2::text[])
     GROUP BY a.article_id, c.category_code, c.category_name, sc.sub_category_code, sc.sub_category_name, gf.form_code, gf.form_name`,
    [context.tenant.tenant_id, codes],
  )).rows;
}

async function getCategories(pool, context) {
  return (await pool.query(
    'SELECT category_id, category_code, category_name FROM categories WHERE tenant_id = $1',
    [context.tenant.tenant_id],
  )).rows;
}

async function getSubCategories(pool, context) {
  return (await pool.query(
    `SELECT sc.sub_category_id, sc.sub_category_code, sc.sub_category_name, c.category_code, c.category_name
     FROM sub_categories sc
     JOIN categories c ON c.category_id = sc.category_id AND c.tenant_id = sc.tenant_id
     WHERE sc.tenant_id = $1`,
    [context.tenant.tenant_id],
  )).rows;
}

async function getForms(pool, context) {
  return (await pool.query(
    'SELECT form_id, form_code, form_name FROM galenic_forms WHERE tenant_id = $1',
    [context.tenant.tenant_id],
  )).rows;
}

function printPlan(plan, mode) {
  console.log(JSON.stringify({
    mode,
    SOURCE_ROWS: plan.sourceRows,
    EXCLUDED_DUPLICATE_ROWS: plan.excludedDuplicateRows,
    FINAL_IMPORT_ROWS: plan.finalRows,
    DUPLICATE_ARTICLE_CODES_AFTER_FILTER: plan.duplicateCodes.length,
    INVALID_ROWS: plan.invalidRows.length,
    EXISTING_EXACT_MATCH: plan.existingExactMatch,
    PRODUCTS_TO_CREATE: plan.productsToCreate.length,
    PRODUCTS_TO_UPDATE: 0,
    PRODUCTS_TO_SKIP: plan.existingExactMatch,
    EXISTING_DIFFERENT: plan.existingDifferent,
    CONFLICTS: plan.conflicts.length,
    CATEGORIES_TO_CREATE: plan.categoriesToCreate.length,
    SUBCATEGORIES_TO_CREATE: plan.subCategoriesToCreate.length,
    FORMS_TO_CREATE: plan.formsToCreate.length,
    LOTS_TO_CREATE: 0,
    STOCK_MOVEMENTS_TO_CREATE: 0,
    OPENING_STOCK_QTY: 0,
    READY_TO_APPLY: plan.readyToApply ? 'YES' : 'NO',
    conflicts: plan.conflicts,
  }, null, 2));
}

function articleMatches(article, row) {
  return productKey(article.commercial_name) === productKey(row.product)
    && article.category_code === row.categoryCode
    && article.sub_category_code === row.subCategoryCode
    && article.form_code === formCode(row.form);
}

function isValidStructured(row) {
  const expected = `${row.categoryCode}-${row.subCategoryCode}`;
  return /^[A-Z]{2,5}-[A-Z0-9]{2,5}-\d{5}$/.test(row.articleCode) && row.articleCode.startsWith(`${expected}-`);
}

function countValues(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function formCode(value) {
  return deterministicCode('FRM', value);
}

function deterministicCode(prefix, value) {
  const hash = crypto.createHash('sha1').update(stripAccents(String(value)).toUpperCase()).digest('hex').slice(0, 6).toUpperCase();
  const slug = stripAccents(String(value)).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'REF';
  return `${prefix}-${slug}-${hash}`.slice(0, 30);
}

function normalizeHeader(value) {
  return stripAccents(String(value ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');
}

function key(value) {
  return stripAccents(String(value ?? '').trim().toLowerCase()).replace(/\s+/g, ' ');
}

function productKey(value) {
  return stripAccents(String(value ?? '').trim().toUpperCase())
    .replace(/^[^A-Z0-9]+/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function clean(value) {
  const result = String(value ?? '').trim().replace(/\s+/g, ' ');
  return result || null;
}

function stripAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
