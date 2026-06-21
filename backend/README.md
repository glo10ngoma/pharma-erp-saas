# Pharma ERP Backend

Backend NestJS du jalon Auth + Articles.

## Demarrage

```bash
npm install
cp .env.example .env
npm run start:dev
```

Variables minimales :

```text
APP_PORT=3000
DATABASE_URL=postgresql://...
DATABASE_SSL=true
JWT_SECRET=dev_secret_change_me
JWT_EXPIRES_IN=1d
```

Swagger local :

```text
http://localhost:3000/docs
```

## Connexion DEV

Initialiser la base depuis la racine du projet :

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed_dev.sql
```

Identifiants :

```text
Email: admin@demo.local
Password: admin123
```
