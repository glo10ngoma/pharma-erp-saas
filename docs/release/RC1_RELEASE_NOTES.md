# RC1 Release Notes

Version: ERP Pharmaceutique SaaS V1.0 RC1
Date: 28/06/2026

## Positionnement

Cette release candidate couvre le socle V1 pour une pharmacie pilote en RDC/Afrique centrale.

## Modules inclus

- Authentification JWT.
- Utilisateurs, roles, permissions, sites.
- Referentiel pharmaceutique.
- Articles avec code-barres ready.
- Achats multi-lignes premium.
- Lots, FEFO, stocks et stock a date.
- Inventaires physiques.
- Transferts inter-sites.
- POS caisse rapide, tactile, scanner-ready.
- Paiement FC/USD avec comptabilite interne USD.
- Caisse, sessions et mouvements.
- Assurances et creances.
- Comptabilite simplifiee.
- Dashboard BI.
- Rapports imprimables/exportables.
- Notifications intelligentes frontend.
- Analyses avancees.
- Administration.

## Points forts RC1

- Multi-tenant applique cote backend.
- Permissions par endpoint.
- FEFO obligatoire en vente.
- Aucune modification stock sans `stock_movements`.
- POS mode caisse professionnel.
- Exports Excel/CSV/JSON sur pages metier principales.
- Documentation complete par role.
- Validations automatisees MVP/V1/RC1.

## Performance

Optimisation RC1.4:

- Bundle JS initial reduit de 1,072.83 kB a 539.95 kB.
- Recharts charge uniquement sur Dashboard BI/Analyses.
- Pages lourdes en lazy loading.

## Securite

Hardening RC1.5:

- CORS strict obligatoire en production.
- `JWT_SECRET` obligatoire en production.
- Rate limit login.
- Headers HTTP defensifs.
- Audit npm documente.

## Compatibilite deploiement

- Backend: Railway/Render.
- Frontend: Vercel.
- Database: Supabase PostgreSQL.
- Devise interne: USD.
- Devise client RDC: CDF/FC.

## Limitations connues

Voir `KNOWN_LIMITATIONS_V1.md`.

## Validation release

Commandes RC1:

```bash
cd frontend
npm run build

cd ../backend
npm run build
npm run validate:mvp -- all
npm run validate:v1
npm run validate:rc1
```

