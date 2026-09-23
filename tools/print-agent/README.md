# PharmaERP Print Agent

Agent local Windows pour impression silencieuse des tickets POS PharmaERP.

## Demarrage

```powershell
cd tools\print-agent
npm run start
```

L'agent ecoute uniquement `http://127.0.0.1:17373`.

## Endpoints

- `GET /health`
- `GET /printers`
- `POST /print`

Le CORS accepte par defaut `https://pharma-erp-saas-five.vercel.app`, `http://localhost:5173` et `http://127.0.0.1:5173`.

## Installation Windows

```powershell
npm run build
powershell -ExecutionPolicy Bypass -File scripts\install-startup.ps1
```

Pour produire un executable autonome, utiliser `npm run build:exe` sur un poste disposant de `pkg`.
