const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

function sanitizeConnectionString(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function summarize(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port,
      database: url.pathname.replace(/^\//, ''),
      hasSslParam: url.searchParams.has('sslmode') || url.searchParams.has('pgbouncer'),
      usesPooler: url.hostname.includes('pooler.supabase.com') || url.searchParams.get('pgbouncer') === 'true',
      length: connectionString.length,
    };
  } catch {
    return { invalid: true, length: connectionString.length };
  }
}

function describeError(error) {
  if (!(error instanceof Error)) return { value: String(error) };
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    errno: error.errno,
    address: error.address,
    port: error.port,
    cause: error.cause ? describeError(error.cause) : undefined,
    errors: Array.isArray(error.errors) ? error.errors.map(describeError) : undefined,
    stack: error.stack,
  };
}

async function main() {
  const connectionString = sanitizeConnectionString(process.env.DATABASE_URL);
  console.log(JSON.stringify({
    appEnv: process.env.APP_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    cwd: process.cwd(),
    databaseUrlPresent: Boolean(connectionString),
    summary: summarize(connectionString),
  }, null, 2));

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('STEP_CONNECT');
    await client.connect();
    console.log('STEP_SELECT_1');
    console.log(JSON.stringify((await client.query('SELECT 1 AS ok')).rows, null, 2));
    console.log('STEP_USERS');
    console.log(JSON.stringify((await client.query('SELECT user_id, email FROM users WHERE is_active=true ORDER BY created_at ASC LIMIT 1')).rows, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: describeError(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
      console.log('STEP_END');
    } catch {}
  }
}

main();
