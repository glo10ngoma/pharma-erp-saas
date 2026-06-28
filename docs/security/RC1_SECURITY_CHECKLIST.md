# RC1 Security Checklist

Date: 28/06/2026

## Avant mise en production

- [ ] `APP_ENV=production`.
- [ ] `JWT_SECRET` long, aleatoire, different de `change_me`.
- [ ] `JWT_EXPIRES_IN` defini selon politique produit.
- [ ] `CORS_ORIGINS` contient uniquement les URLs frontend autorisees.
- [ ] `DATABASE_URL` stocke uniquement dans les variables serveur.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` jamais exposee au frontend.
- [ ] `VITE_API_URL` pointe vers l'API publique staging/production.
- [ ] `.env` reels non suivis par Git.
- [ ] `.env.example` sans secret reel.

## Auth / JWT

- [ ] `/auth/login` public uniquement.
- [ ] `/auth/me` protege JWT.
- [ ] `/auth/change-password` protege JWT.
- [ ] Aucun `passwordHash` dans les reponses.
- [ ] Rate limit login actif.
- [ ] Logout frontend supprime token et utilisateur courant.

## Multi-tenant

- [ ] Chaque SELECT metier filtre `tenant_id` depuis JWT.
- [ ] Chaque INSERT metier utilise `tenant_id` depuis JWT.
- [ ] Chaque UPDATE/DELETE metier inclut `tenant_id`.
- [ ] Aucun endpoint n'accepte `tenantId` frontend comme source de verite.
- [ ] `site_id` controle pour utilisateurs limites site.
- [ ] Tests cross-tenant manuels effectues avant production.

## Permissions

- [ ] Tous les controleurs non publics ont `RequirePermission`.
- [ ] Toutes les actions sensibles ont une permission dediee.
- [ ] Les menus frontend ne sont qu'une aide UI, pas une barriere de securite.
- [ ] ADMIN/STAGING/DEMO ont les permissions V1 necessaires.

## Validation

- [ ] `ValidationPipe` global actif.
- [ ] `whitelist=true`.
- [ ] `forbidNonWhitelisted=true`.
- [ ] `transform=true`.
- [ ] DTO validates pour payloads create/update.
- [ ] IDs et query params a renforcer avec pipes UUID en V2.

## Erreurs / Logs

- [ ] Aucune stack trace cote navigateur.
- [ ] Erreurs metier explicites.
- [ ] Aucun JWT dans logs.
- [ ] Aucun password dans logs.
- [ ] Aucun refresh token/cookie secret dans logs.

## Headers / CORS

- [ ] CORS restreint en production.
- [ ] `X-Content-Type-Options` present.
- [ ] `X-Frame-Options` present.
- [ ] `Referrer-Policy` present.
- [ ] `Permissions-Policy` present.
- [ ] Helmet/CSP planifies avec tests Swagger/Vercel.

## Dependances

- [ ] `npm audit` backend execute.
- [ ] `npm audit` frontend execute.
- [ ] Vulns hautes documentees.
- [ ] Upgrades majeurs planifies hors RC.

## Validation release

- [ ] `npm run build` backend OK.
- [ ] `npm run build` frontend OK.
- [ ] `npm run validate:mvp -- all` OK.
- [ ] `npm run validate:v1` OK.
- [ ] `npm run validate:rc1` OK.

