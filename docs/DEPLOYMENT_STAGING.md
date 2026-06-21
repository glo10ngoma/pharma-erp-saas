# Deploiement Staging V1

Ce guide prepare une mise en ligne staging du backend NestJS, du frontend React/Vite et de la base Supabase PostgreSQL.

## Backend Railway / Render

### Build et start

```bash
cd backend
npm install
npm run build
npm start
```

Le script `npm start` lance `node dist/main.js`. Le serveur ecoute `process.env.PORT` fourni par Railway/Render, puis `APP_PORT`, puis `3000`.

### Variables backend

```text
APP_ENV=staging
PORT=<fourni par la plateforme>
DATABASE_URL=<url PostgreSQL Supabase>
DATABASE_SSL=true
JWT_SECRET=<secret long et unique staging>
JWT_EXPIRES_IN=1d
CORS_ORIGINS=https://<frontend-staging>.vercel.app
FRONTEND_URL=https://<frontend-staging>.vercel.app
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key si necessaire cote backend>
```

Ne jamais exposer `JWT_SECRET`, `DATABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` dans le frontend, les logs publics ou le depot.

### Checklist Railway / Render

- Creer un service depuis le dossier `backend`.
- Build command : `npm install && npm run build`.
- Start command : `npm start`.
- Definir toutes les variables backend.
- Verifier que `/api/v1/auth/login` repond.
- Verifier que `/docs` affiche Swagger.
- Verifier que CORS accepte uniquement le domaine Vercel staging.

## Frontend Vercel

### Build

```bash
cd frontend
npm install
npm run build
```

### Variables frontend

```text
VITE_API_URL=https://<backend-staging>/api/v1
```

### Checklist Vercel

- Root directory : `frontend`.
- Build command : `npm run build`.
- Output directory : `dist`.
- Definir `VITE_API_URL`.
- Garder `frontend/vercel.json` pour le fallback SPA React Router.
- Verifier login et navigation apres deploiement.

## Supabase PostgreSQL

### Schema et seed staging

Appliquer le schema et le seed staging sur une base staging separee :

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" \
  -v admin_password_hash='<bcrypt_hash_local_non_commite>' \
  -f database/seed_staging.sql
```

Le hash bcrypt doit etre genere et conserve localement. Ne pas commiter le mot de passe temporaire ni son hash.

### RLS

Le backend utilise la connexion PostgreSQL serveur et impose `tenant_id` depuis le JWT applicatif. Ne pas activer une politique RLS bloquante sans verifier que le role utilise par `DATABASE_URL` est compatible avec les policies Supabase.

### Checklist Supabase

- `database/schema.sql` applique sans erreur.
- `database/seed_dev.sql` applique sans erreur.
- `DATABASE_SSL=true` si Supabase exige SSL.
- Connexion backend OK.
- RLS non bloquante pour l'API backend.
- Backups staging configures si donnees de demo importantes.

## Tests Apres Deploiement

Executer depuis `backend` en ciblant l'API staging :

```bash
MVP_API_URL=https://<backend-staging>/api/v1 npm run validate:mvp -- all
MVP_API_URL=https://<backend-staging>/api/v1 npm run validate:v1
```

Sur PowerShell :

```powershell
$env:MVP_API_URL="https://<backend-staging>/api/v1"
npm run validate:mvp -- all
npm run validate:v1
```

### Parcours manuel

- Login admin demo.
- Dashboard V1.
- Creation article.
- Achat valide vers stock.
- Vente CASH avec caisse.
- Vente assurance et paiement creance.
- Inventaire physique valide.
- Balance comptable et grand livre.
- Reporting BI.
- Swagger `/docs`.

## Limites Staging

- `seed_dev.sql` reste un seed de demonstration, pas un seed client final.
- Les tests `validate:v1` creent des donnees horodatees.
- Les modules hors V1 restent non importes dans `AppModule`.
