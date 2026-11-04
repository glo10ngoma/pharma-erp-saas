// Run after npm run build. Install @electric-sql/pglite in a temporary directory
// and set PGLITE_MODULE to its absolute module path; no live database is used.
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const { InventoriesRepository } = require('../dist/inventories/inventories.repository');
const { InventoriesController } = require('../dist/inventories/inventories.controller');

const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

async function main() {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE sites (site_id uuid PRIMARY KEY, tenant_id uuid, site_name text);
      CREATE TABLE articles (article_id uuid PRIMARY KEY, tenant_id uuid, article_code text,
        commercial_name text, sales_unit_id uuid, packaging_unit_id uuid, packaging text);
      CREATE TABLE product_units (product_unit_id uuid, tenant_id uuid, unit_label text);
      CREATE TABLE lots (lot_id uuid PRIMARY KEY, tenant_id uuid, article_id uuid, lot_number text, expiry_date date);
      CREATE TABLE stocks (tenant_id uuid, site_id uuid, lot_id uuid, quantity_available numeric(14,3));
      CREATE TABLE inventory_sessions (inventory_id uuid PRIMARY KEY, tenant_id uuid, site_id uuid,
        inventory_number text, inventory_type text, inventory_date date, status text, notes text,
        created_by uuid, validated_by uuid, created_at timestamp, validated_at timestamp);
      CREATE TABLE inventory_items (inventory_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid,
        inventory_id uuid REFERENCES inventory_sessions, article_id uuid REFERENCES articles,
        lot_id uuid REFERENCES lots, system_quantity numeric(14,3), counted_quantity numeric(14,3),
        difference_quantity numeric(14,3), reason text, counted_by uuid, counted_at timestamp,
        UNIQUE(inventory_id,lot_id));
      CREATE TABLE audit_logs (tenant_id uuid, user_id uuid, table_name text, record_id uuid,
        action_type text, new_value jsonb);
      INSERT INTO articles (article_id,tenant_id,commercial_name)
        SELECT ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
          '${uuid(90001)}', 'Article ' || n FROM generate_series(1,9002) n;
      INSERT INTO lots SELECT article_id,tenant_id,article_id,'LOT-' || commercial_name,'2028-01-01' FROM articles;
      INSERT INTO sites VALUES ('${uuid(90002)}','${uuid(90001)}','CANA test'),
        ('${uuid(90003)}','${uuid(90001)}','Other site'), ('${uuid(90004)}','${uuid(90005)}','Other tenant');
      INSERT INTO stocks SELECT tenant_id,'${uuid(90002)}',lot_id,
        CASE WHEN lot_id='${uuid(9001)}' THEN -1 WHEN lot_id='${uuid(9002)}' THEN NULL
             WHEN lot_id='${uuid(1)}' THEN 0 ELSE 12.125 END FROM lots;
      INSERT INTO stocks VALUES ('${uuid(90001)}','${uuid(90003)}','${uuid(9001)}',10),
        ('${uuid(90005)}','${uuid(90004)}','${uuid(9002)}',10);
      INSERT INTO inventory_sessions (inventory_id,tenant_id,site_id,status) VALUES
        ('${uuid(90006)}','${uuid(90001)}','${uuid(90002)}','IN_PROGRESS'),
        ('${uuid(90007)}','${uuid(90001)}','${uuid(90003)}','IN_PROGRESS'),
        ('${uuid(90008)}','${uuid(90005)}','${uuid(90004)}','IN_PROGRESS'),
        ('${uuid(90009)}','${uuid(90001)}','${uuid(90002)}','CLOSED'),
        ('${uuid(90010)}','${uuid(90001)}','${uuid(90002)}','IN_PROGRESS');
    `);
    let queries = 0;
    const query = async (runner, sql, params) => {
      queries++;
      const result = await runner.query(sql, params);
      return { ...result, rowCount: result.affectedRows };
    };
    const db = {
      query: (sql, params) => query(pg, sql, params),
      transaction: (fn) => pg.transaction((tx) => fn({ query: (sql, params) => query(tx, sql, params) })),
    };
    const repo = new InventoriesRepository(db);
    const user = { tenantId: uuid(90001), siteId: uuid(90002), userId: uuid(90011) };
    const originalStocks = (await pg.query('SELECT * FROM stocks ORDER BY tenant_id,site_id,lot_id')).rows;
    const start = performance.now();
    const inventory = await repo.preloadItems(user, uuid(90006));
    const elapsed = Math.round(performance.now() - start);
    assert.equal(inventory.items.length, 9000);
    assert.equal(queries, 4, 'Query count must stay constant for 9,000 lots');
    assert(inventory.items.every((i) => i.physicalQuantity === null && i.differenceQuantity === null && i.countedAt === null));
    assert(inventory.items.some((i) => i.systemQuantity === 0));
    assert(inventory.items.some((i) => i.systemQuantity === 12.125));
    const audit = await pg.query('SELECT count(*)::int AS n FROM audit_logs');
    assert.equal(audit.rows[0].n, 9000);
    assert.deepEqual((await pg.query('SELECT * FROM stocks ORDER BY tenant_id,site_id,lot_id')).rows, originalStocks);

    // Retry preserves existing counts and the original theoretical-stock snapshot.
    await pg.query(`UPDATE inventory_items SET counted_quantity=7, difference_quantity=7,
      reason='Count preserved', counted_at=now() WHERE inventory_id=$1 AND lot_id=$2`, [uuid(90006), uuid(1)]);
    await pg.query('UPDATE stocks SET quantity_available=50 WHERE site_id=$1 AND lot_id=$2', [user.siteId, uuid(1)]);
    const retry = await repo.preloadItems(user, uuid(90006));
    const item = retry.items.find((i) => i.lotId === uuid(1));
    assert.equal(retry.items.length, 9000);
    assert.equal(item.physicalQuantity, 7);
    assert.equal(item.systemQuantity, 0);
    assert.equal(item.reason, 'Count preserved');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n, 9000);
    assert.equal(await repo.preloadItems(user, uuid(90007)), null);
    assert.equal(await repo.preloadItems(user, uuid(90008)), null);
    await assert.rejects(repo.preloadItems(user, uuid(90009)), /INVENTORY_NOT_IN_PROGRESS/);
    assert.equal(Reflect.getMetadata('required_permission', InventoriesController.prototype.preloadItems), 'inventories.count');

    // An audit failure rolls back the inserted lines as well.
    await pg.exec(`CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'AUDIT_FAILED'; END $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit();`);
    await assert.rejects(repo.preloadItems(user, uuid(90010)), /AUDIT_FAILED/);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM inventory_items WHERE inventory_id=$1', [uuid(90010)])).rows[0].n, 0);
    console.log(`INVENTORY_PRELOAD=PASS; 9000 lots; 4 repository queries; local PGlite ${elapsed} ms`);
    console.log('TENANT_SITE_ISOLATION=PASS; NULL_COUNTS=PASS; ZERO_AND_DECIMALS=PASS; RETRY_PRESERVES_COUNTS=PASS; AUDIT_ROLLBACK=PASS; PERMISSION=PASS');
  } finally {
    await pg.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
