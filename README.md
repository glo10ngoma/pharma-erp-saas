# Pharma ERP SaaS V2

ERP pharmaceutique SaaS multi-tenant pour pharmacies, depots, cliniques et reseaux de pharmacies.

## Stack

- Backend: NestJS + TypeScript
- Frontend: React + TypeScript + Vite
- Database: PostgreSQL / Supabase
- Auth: JWT
- API: REST + Swagger

## Prerequis

- Node.js + npm
- Une base PostgreSQL/Supabase initialisee avec `database/schema.sql`
- Le seed DEV `database/seed_dev.sql`

## Initialiser la base DEV

Executer le schema, puis le seed de developpement :

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed_dev.sql
```

Le seed cree le tenant `DEMO`, le site `DEMO-SITE`, le role `ADMIN`, les permissions MVP, un registre caisse demo et l'utilisateur :

```text
Email: admin@demo.local
Password: admin123
```

## Backend

```bash
cd backend
npm install
copy .env.example .env
npm run start:dev
```

Configurer `backend/.env` avec vos valeurs locales :

```text
APP_PORT=3000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DATABASE_SSL=true
JWT_SECRET="change-me"
JWT_EXPIRES_IN=1d
```

Ne jamais commiter de secrets reels dans le README, les seeds ou les fichiers exemples.

API locale :

```text
http://localhost:3000/api/v1
http://localhost:3000/docs
```

En staging Railway/Render, le backend ecoute `PORT` si la plateforme le fournit. Le script de production est :

```bash
npm run build
npm start
```

## Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Application locale :

```text
http://127.0.0.1:5173
```

Le frontend utilise `VITE_API_URL` si defini, sinon `http://localhost:3000/api/v1`.

Pour Vercel, definir `VITE_API_URL` avec l'URL publique du backend, par exemple :

```text
https://votre-api-staging.up.railway.app/api/v1
```

Guide complet staging : `docs/DEPLOYMENT_STAGING.md`.

## Validation MVP et V1

Demarrer le backend, puis lancer depuis `backend/` :

```bash
npm run validate:mvp -- auth
npm run validate:mvp -- articles
npm run validate:mvp -- purchase-stock
npm run validate:mvp -- sale-fefo
npm run validate:mvp -- cash-session
npm run validate:mvp -- all
npm run validate:v1
```

`validate:mvp` valide le noyau historique : login, articles, entree achat vers stock, vente FEFO et session caisse.

`validate:v1` valide les blocs V1 de pre-production :

- Auth
- Users / Roles / Sites
- Referentiel pharmaceutique
- Achat vers stock
- Vente + caisse
- Assurance + creance
- Inventaire
- Comptabilite
- Reporting BI

## Checklist demo V1 locale

- `backend/.env` configure sans secrets commites
- `database/schema.sql` applique
- `database/seed_dev.sql` applique
- Login admin demo OK
- `/auth/me` protege par JWT
- Permissions chargees dans le JWT
- `tenant_id` filtre les donnees metier
- `site_id` limite les utilisateurs rattaches a un site
- Achats valides creent lots, stocks, `PURCHASE_IN` et audit
- Ventes CASH valides sortent FEFO, creent `SALE_OUT`, paiement et audit
- Caisse ouvre/ferme une session et cree les mouvements cash
- Assurance cree la part patient, la creance assurance et permet le paiement de creance
- Inventaire valide cree `INVENTORY_GAIN` ou `INVENTORY_LOSS`
- Comptabilite cree des ecritures automatiques equilibrees
- Reporting BI affiche KPI, ventes, stock, marges, caisse, creances et peremptions
- `npm run build` backend OK
- `npm run build` frontend OK
- `npm run validate:mvp -- all` OK
- `npm run validate:v1` OK

## Routes V1 actives

- Auth: `/auth/login`, `/auth/me`
- Administration: `/users`, `/roles`, `/permissions`, `/sites`
- Referentiel: `/articles`, `/categories`, `/sub-categories`, `/galenic-forms`, `/administration-routes`, `/product-types`, `/suppliers`, `/customers`
- Achats / stock: `/purchases`, `/lots`, `/stocks`, `/stock-movements`
- Vente / caisse: `/sales`, `/payments`, `/cash`
- Assurances / creances: `/organizations`, `/insurance-plans`, `/memberships`, `/receivables`
- Inventaires: `/inventories`
- Comptabilite: `/accounting/accounts`, `/accounting/journals`, `/accounting/entries`, `/accounting/trial-balance`, `/accounting/general-ledger`
- Reporting BI: `/reports/dashboard`, `/reports/sales`, `/reports/stock`, `/reports/margins`, `/reports/cash`, `/reports/receivables`, `/reports/expiry`, `/reports/top-products`

Swagger local :

```text
http://localhost:3000/docs
```

## Modules hors V1

Transferts, prescriptions, notifications, pieces jointes et modules connexes restent non importes dans `AppModule` tant qu'ils ne sont pas inclus dans un sprint valide.
