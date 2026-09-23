const http = require('node:http');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PRINT_AGENT_PORT || 17373);
const VERSION = '0.1.0';
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://pharma-erp-saas-five.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const ALLOWED_ORIGINS = (process.env.PRINT_AGENT_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const server = http.createServer((req, res) => {
  if (!applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return sendJson(res, 204, null);

  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', version: VERSION, bindAddress: HOST, port: PORT });
  }
  if (req.method === 'GET' && url.pathname === '/printers') {
    return listPrinters().then(
      (printers) => sendJson(res, 200, { printers }),
      (error) => sendJson(res, 200, { printers: [], warning: 'PRINTER_LIST_UNAVAILABLE', message: error.message }),
    );
  }
  if (req.method === 'POST' && url.pathname === '/print') {
    return readJsonBody(req).then(
      (body) => handlePrint(body, res).catch((error) => sendJson(res, 400, { error: 'INVALID_PRINT_JOB', message: error.message })),
      (error) => sendJson(res, 400, { error: 'INVALID_PAYLOAD', message: error.message }),
    );
  }
  return sendJson(res, 404, { error: 'NOT_FOUND' });
});

server.listen(PORT, HOST, () => {
  console.log(`PharmaERP print agent ${VERSION} listening on http://${HOST}:${PORT}`);
});

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      sendJson(res, 403, { error: 'ORIGIN_NOT_ALLOWED' });
      return false;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  if (payload === null) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

function listPrinters() {
  const command = [
    'Get-CimInstance Win32_Printer',
    "Select-Object @{Name='name';Expression={$_.Name}},@{Name='isDefault';Expression={$_.Default}}",
    'ConvertTo-Json -Depth 3',
  ].join(' | ');
  return runPowerShell(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command])
    .catch(() => listPrintersFromRegistry())
    .then((stdout) => {
    const raw = stdout.trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((row) => ({ name: String(row.name || '').trim(), isDefault: row.isDefault === true }))
      .filter((row) => row.name);
  });
}

function listPrintersFromRegistry() {
  const command = [
    "$devices = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices'",
    "$default = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name Device -ErrorAction SilentlyContinue).Device",
    "$defaultName = if ($default) { ($default -split ',')[0] } else { '' }",
    "$devices.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | Select-Object @{Name='name';Expression={$_.Name}},@{Name='isDefault';Expression={$_.Name -eq $defaultName}} | ConvertTo-Json -Depth 3",
  ].join('; ');
  return runPowerShell(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]);
}

async function handlePrint(body, res) {
  const job = validatePrintJob(body);
  if (process.env.PRINT_AGENT_DRY_RUN === '1') {
    return sendJson(res, 200, { status: 'queued', dryRun: true });
  }
  const printers = await listPrinters();
  if (!printers.some((printer) => printer.name === job.printerName)) {
    throw new Error('printerName must match a detected local printer');
  }

  const jobPath = path.join(os.tmpdir(), `pharmaerp-print-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(jobPath, JSON.stringify(job), 'utf8');
  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'print-ticket.ps1');
  runPowerShell(['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-JobPath', jobPath])
    .then(() => sendJson(res, 200, { status: 'queued' }))
    .catch((error) => sendJson(res, 500, { error: 'PRINT_FAILED', message: error.message }))
    .finally(() => fs.promises.rm(jobPath, { force: true }).catch(() => undefined));
}

function validatePrintJob(body) {
  const printerName = String(body?.printerName || '').trim();
  const paperWidthMm = Number(body?.paperWidthMm);
  const copies = Number(body?.copies);
  const text = String(body?.ticket?.text || '').trim();
  const html = String(body?.ticket?.html || '').trim();
  if (!printerName) throw new Error('printerName is required');
  if (![58, 80].includes(paperWidthMm)) throw new Error('paperWidthMm must be 58 or 80');
  if (!Number.isInteger(copies) || copies < 1 || copies > 5) throw new Error('copies must be between 1 and 5');
  if (!text && !html) throw new Error('ticket.text or ticket.html is required');
  return {
    printerName,
    paperWidthMm,
    copies,
    ticket: {
      offlineReference: String(body?.ticket?.offlineReference || ''),
      validatedAt: String(body?.ticket?.validatedAt || ''),
      text: text || stripHtml(html),
    },
  };
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/tr>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function runPowerShell(args) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', args, { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}
