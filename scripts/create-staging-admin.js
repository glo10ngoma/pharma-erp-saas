#!/usr/bin/env node

const readline = require('readline');

function loadBcrypt() {
  const candidates = [
    'bcryptjs',
    'bcrypt',
    '../backend/node_modules/bcryptjs',
    '../backend/node_modules/bcrypt',
  ];

  for (const name of candidates) {
    try {
      return require(name);
    } catch {
      // Try next candidate.
    }
  }

  process.stderr.write('bcrypt is not installed. Run: npm install bcrypt\n');
  process.exit(1);
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stderr;
    const rl = readline.createInterface({ input, output });
    const wasRaw = input.isTTY && input.isRaw;

    if (input.isTTY) input.setRawMode(true);
    output.write(prompt);

    let value = '';
    input.on('data', function onData(buffer) {
      const char = buffer.toString('utf8');

      if (char === '\r' || char === '\n') {
        input.removeListener('data', onData);
        if (input.isTTY) input.setRawMode(Boolean(wasRaw));
        output.write('\n');
        rl.close();
        resolve(value);
        return;
      }

      if (char === '\u0003') {
        process.exit(130);
      }

      if (char === '\b' || char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    });
  });
}

async function main() {
  const bcrypt = loadBcrypt();
  const mode = process.argv.includes('--psql')
    ? 'psql'
    : process.argv.includes('--sql')
      ? 'sql'
      : 'hash';

  const password = process.env.STAGING_TEMP_PASSWORD || await readHidden('Temporary staging password: ');
  if (!password) {
    process.stderr.write('Password is required.\n');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  if (mode === 'sql') {
    process.stdout.write([
      'UPDATE users',
      `SET password_hash = '${escapeSqlLiteral(hash)}',`,
      '    is_active = TRUE',
      "WHERE username = 'admin.staging'",
      "  AND email = 'admin@staging.local';",
    ].join('\n'));
    return;
  }

  if (mode === 'psql') {
    process.stdout.write(`psql "$DATABASE_URL" -v admin_password_hash='${escapeSqlLiteral(hash)}' -f database/seed_staging.sql`);
    return;
  }

  process.stdout.write(hash);
}

main().catch(() => {
  process.stderr.write('Failed to generate bcrypt hash.\n');
  process.exit(1);
});
