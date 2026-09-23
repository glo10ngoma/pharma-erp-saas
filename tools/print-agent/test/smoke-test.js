const { spawn } = require('node:child_process');

const port = 17374;
const child = spawn(process.execPath, ['src/server.js'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  env: { ...process.env, PRINT_AGENT_PORT: String(port), PRINT_AGENT_DRY_RUN: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

async function waitForHealth() {
  for (let index = 0; index < 30; index++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error('Print agent did not become healthy');
}

(async () => {
  try {
    const health = await waitForHealth();
    if (health.bindAddress !== '127.0.0.1') throw new Error('Agent is not loopback-only');
    const printers = await fetch(`http://127.0.0.1:${port}/printers`);
    if (!printers.ok) throw new Error(`Printer listing failed: ${printers.status}`);
    const print = await fetch(`http://127.0.0.1:${port}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerName: 'DRY-RUN',
        paperWidthMm: 80,
        copies: 1,
        ticket: { offlineReference: 'SMOKE', validatedAt: new Date().toISOString(), text: 'PharmaERP smoke test' },
      }),
    });
    if (!print.ok) throw new Error(`Dry-run print failed: ${print.status}`);
    console.log('PRINT_AGENT_SMOKE_TEST=PASS');
  } finally {
    if (!child.killed) child.kill();
  }
})().catch((error) => {
  if (!child.killed) child.kill();
  console.error(error);
  process.exit(1);
});
