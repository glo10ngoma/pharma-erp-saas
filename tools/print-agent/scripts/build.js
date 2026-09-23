const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(
  path.join(dist, 'start-print-agent.cmd'),
  [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0\\.."',
    'node src\\server.js',
    '',
  ].join('\r\n'),
);
fs.writeFileSync(
  path.join(dist, 'README-installation.txt'),
  [
    'PharmaERP Print Agent',
    '',
    '1. Installer Node.js 20+ sur le poste caisse si l EXE autonome n est pas utilise.',
    '2. Lancer start-print-agent.cmd ou PharmaERP-Print-Agent.exe.',
    '3. Pour demarrage Windows, executer scripts\\install-startup.ps1 depuis ce dossier.',
    '4. L agent ecoute uniquement http://127.0.0.1:17373.',
    '',
  ].join('\r\n'),
);
console.log(`Build artifacts written to ${dist}`);
