# RC1 Deployment Security

Date: 28/06/2026

## Variables backend Railway/Render

Obligatoires:

```text
APP_ENV=production
PORT=<fourni par hebergeur>
CORS_ORIGINS=https://votre-frontend.vercel.app
DATABASE_URL=<secret Railway/Supabase>
JWT_SECRET=<secret long et aleatoire>
JWT_EXPIRES_IN=1d
SUPABASE_URL=<url projet>
SUPABASE_SERVICE_ROLE_KEY=<secret serveur uniquement si necessaire>
```

Regles:

- Ne jamais mettre `JWT_SECRET=change_me` en production.
- Ne jamais exposer `DATABASE_URL` au frontend.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` au frontend.
- Si plusieurs frontends sont autorises, les separer par virgule dans `CORS_ORIGINS`.

## Variables frontend Vercel

```text
VITE_API_URL=https://votre-api.railway.app/api/v1
```

Regles:

- Aucune cle service Supabase cote Vercel frontend.
- Aucun secret JWT cote frontend.
- Le frontend stocke uniquement le token utilisateur emis par l'API.

## CORS

En production, l'API refuse de demarrer si aucune origine frontend n'est configuree.

Exemple:

```text
CORS_ORIGINS=https://pharma-erp.vercel.app,https://staging-pharma-erp.vercel.app
```

## JWT

L'API refuse de demarrer en production si:

- `JWT_SECRET` est absent;
- `JWT_SECRET=change_me`.

Rotation recommandee:

- generer un nouveau secret par environnement;
- documenter la date de rotation;
- deconnecter les sessions si rotation immediate.

## Rate limiting login

RC1.5 applique une limite memoire:

- 10 echecs par email;
- fenetre 15 minutes.

Limite:

- non partage entre instances.

Recommandation V2:

- store Redis;
- limitation par IP + email;
- alerting sur brute force.

## Headers HTTP

Headers ajoutes cote API:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP/Helmet:

- non active en RC1 pour eviter de casser Swagger ou les integrations;
- a tester en staging dedie.

## Supabase

Checklist:

- [ ] Schema applique.
- [ ] Seeds staging/demo sans secret clair.
- [ ] RLS non bloquante pour l'API backend tant que l'API utilise son modele JWT/tenant.
- [ ] Backups Supabase actifs.
- [ ] Acces SQL restreint aux administrateurs.

## Logs

Ne jamais logger:

- `Authorization`;
- JWT;
- password;
- password hash;
- refresh token;
- cookies;
- `DATABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`.

## Validation apres deploiement

- [ ] Login admin.
- [ ] `/auth/me`.
- [ ] Dashboard BI.
- [ ] Articles.
- [ ] Achat -> stock.
- [ ] POS CASH.
- [ ] Caisse.
- [ ] Assurance/creance.
- [ ] Inventaire.
- [ ] Finance.
- [ ] Rapports.
- [ ] `validate:rc1` contre l'URL staging si possible.

