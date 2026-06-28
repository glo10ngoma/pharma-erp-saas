# RC1 Security Audit

Date: 28/06/2026

## Portee

Audit V1.0 RC1 sans nouvelle fonctionnalite metier. Les controles couvrent JWT, Auth, multi-tenant, permissions, validation, SQL injection, XSS, CSRF, CORS, rate limiting, secrets, logs, erreurs HTTP et dependances npm.

## Synthese

| Domaine | Risque | Criticite | Statut / Correctif |
| --- | --- | --- | --- |
| JWT | Secret par defaut possible si `JWT_SECRET` absent. | Haute en production | Corrige: demarrage refuse en production si `JWT_SECRET` absent ou `change_me`. |
| CORS | Fallback `origin: true` si aucune origine configuree. | Haute en production | Corrige: `CORS_ORIGINS` ou `FRONTEND_URL` obligatoire en production. |
| Rate limit login | Brute force possible sur `/auth/login`. | Moyenne | Corrige: limite memoire par email, 10 echecs / 15 min. |
| Headers HTTP | Pas de headers defensifs explicites. | Moyenne | Corrige partiellement: `nosniff`, `DENY`, `no-referrer`, `Permissions-Policy`. CSP/Helmet documentes pour V2. |
| Dependances backend | `npm audit`: 42 vulnerabilites, dont 7 hautes, surtout Nest CLI/dev tooling et packages transitoires. | Haute | Documente. Pas de mise a jour majeure en RC1 pour eviter regression. |
| Dependances frontend | `npm audit`: Vite/esbuild, 2 vulnerabilites dont 1 haute. | Moyenne/Haute en dev server | Documente. La production Vercel sert le build statique, mais upgrade Vite a planifier. |
| Multi-tenant | Risque cross-tenant si requete oublie `tenant_id`. | Critique | Controle par audit: repositories principaux utilisent `user.tenantId`; routes protegees par JWT. Checklist creee. |
| Permissions | Action sensible sans permission. | Critique | Audit controleurs: toutes les routes non publiques ont `RequirePermission`. |
| Password hash | Exposition accidentelle dans responses. | Haute | `AuthService.toProfile` exclut `passwordHash`; validate:v1 verifie absence. |
| Stack traces | Stack trace retournee au navigateur. | Haute | `BusinessErrorFilter` masque les erreurs internes en `INTERNAL_SERVER_ERROR`. |

## JWT / Auth

Constats:

- `JwtAuthGuard` est global via `APP_GUARD`.
- `/auth/login` est public via `@Public()`.
- `/auth/me` et `/auth/change-password` restent proteges par JWT.
- Les claims utilisateur sont rafraichis depuis la base a chaque requete protegee: role, site, permissions, tenant actif.
- `JWT_EXPIRES_IN` est configurable, valeur par defaut dev: `1d`.
- Pas de refresh token actif dans la reponse courante.
- Logout est frontend: suppression token/local state.
- Passwords hashes via bcrypt/bcryptjs.

Correctifs RC1.5:

- Refus de demarrage production si `JWT_SECRET` absent ou egal a `change_me`.
- Rate limit memoire sur echecs login: 10 echecs par email dans une fenetre de 15 minutes.

Limites:

- Rate limit memoire non partage entre instances Railway. Pour V2: Redis ou throttle store partage.
- Pas de refresh token serveur. Pour V2: rotation refresh token + revoke list.

## Multi-tenant

Constats:

- Le frontend ne fournit pas `tenantId` comme source de verite.
- `AuthUser.tenantId` vient du JWT verifie puis rafraichi depuis la base.
- Les repositories metier utilisent majoritairement `WHERE tenant_id=$1` avec `user.tenantId`.
- Les operations site filtrent ou valident `site_id` selon profil.
- Les ecritures stock utilisent `stock_movements` et `tenant_id`.

Checklist appliquee:

- SELECT metiers: `tenant_id` depuis `user.tenantId`.
- INSERT metiers: `tenant_id` depuis `user.tenantId`.
- UPDATE/DELETE metiers: condition `tenant_id=$1`.
- JOIN metiers: jointures tenant-aware quand la table contient `tenant_id`.
- Site-limited user: filtres `siteId` dans modules sensibles comme lots/stocks/sales/purchases/transfers.

Risque restant:

- Audit manuel, non exhaustif par AST. Recommandation V2: tests automatises cross-tenant par endpoint.

## Permissions / Guards

Constats:

- `JwtAuthGuard` puis `PermissionGuard` sont globaux.
- Tous les controleurs non Auth ont des permissions par endpoint.
- Audit controleurs: aucune route non-auth sans `RequirePermission`.
- `SUPER_ADMIN` contourne `PermissionGuard` par design.

Points de vigilance:

- Les menus frontend respectent les permissions mais le backend reste la source de verite.
- Le code-generator utilise actuellement `articles.read`, accepte pour RC1 mais permission dediee recommandee V2.

## DTO / Validation

Constats:

- `ValidationPipe` global actif:
  - `whitelist: true`;
  - `forbidNonWhitelisted: true`;
  - `transform: true`.
- Les DTO Auth ont `class-validator`.
- Les DTO metiers sont valides par `class-validator` selon modules.

Risque restant:

- Certains `@Param('id') id: string` ne sont pas validates explicitement en UUID. Les requetes parametrees limitent l'injection SQL, mais la validation metier serait plus propre avec `ParseUUIDPipe` en V2.

## SQL Injection

Constats:

- Les repositories utilisent `pg` avec placeholders `$1`, `$2`, etc.
- Les recherches textuelles utilisent params SQL, pas de concatenation directe utilisateur.
- Le scan `query(... ${...})` n'a pas revele de construction SQL utilisateur critique.

Risque restant:

- Continuer a interdire tout SQL dynamique base sur input frontend sans allowlist.

## XSS / CSRF

XSS:

- React echappe les chaines par defaut.
- Aucun usage massif de `dangerouslySetInnerHTML` identifie pendant cet audit.
- Donnees utilisateur affichees dans tableaux/modals, donc garder echappement React.

CSRF:

- Auth par Bearer token dans header `Authorization`.
- Pas de cookies de session backend.
- Risque CSRF faible pour API, sous reserve de ne pas passer a cookie auth sans protection CSRF.

## CORS

Constat initial:

- CORS configurable via `CORS_ORIGINS` ou `FRONTEND_URL`.
- Avant RC1.5, fallback ouvert si aucune origine configuree.

Correctif:

- En production, absence d'origine configuree bloque le demarrage.
- Methodes autorisees explicites.
- Headers autorises: `Content-Type`, `Authorization`.

## Headers HTTP

Correctif RC1.5:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Non ajoute volontairement en RC1:

- Helmet complet.
- CSP stricte.

Raison: Swagger et integrations peuvent necessiter tests fins. A ajouter en V2 apres validation environnement staging.

## Erreurs HTTP / Logs

Constats:

- `BusinessErrorFilter` normalise les erreurs metier.
- Les erreurs internes retournent `INTERNAL_SERVER_ERROR`, pas la stack.
- Pas de logs serveur applicatifs contenant JWT/password detectes dans `backend/src`.

Risque restant:

- Ajouter un logger structure serveur en V2 avec redaction explicite de `Authorization`, `password`, `refreshToken`, cookies.

## Secrets / Variables

Constats:

- `.env.example` contient des placeholders.
- Aucun secret reel attendu dans les fichiers commites.
- `SUPABASE_SERVICE_ROLE_KEY` est documente comme variable serveur uniquement.

Action recommandee:

- Verifier sur Railway/Vercel que les variables sont definies uniquement dans les environnements secrets.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` cote frontend.

## Dependances npm

Commandes:

```bash
cd backend && npm audit --audit-level=low --json
cd frontend && npm audit --audit-level=low --json
```

Resultats:

| Projet | Vulns | Critiques | Hautes | Moderees | Faibles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Backend | 42 | 0 | 7 | 32 | 3 |
| Frontend | 2 | 0 | 1 | 1 | 0 |

Decision RC1:

- Pas de mise a jour automatique: plusieurs correctifs npm audit impliquent des upgrades majeurs Nest/Vite/Jest. Trop risque en phase RC.
- A traiter en sprint technique dedie avec tests complets.

