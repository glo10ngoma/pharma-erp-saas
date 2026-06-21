# ERP Pharmaceutique SaaS V2 — Contexte Codex

Je développe seul un ERP pharmaceutique SaaS multi-tenant pour pharmacies, dépôts, cliniques et réseaux de pharmacies en RDC/Afrique centrale.

## Stack
- Backend : NestJS + TypeScript
- Frontend : React + TypeScript + Vite
- Database : Supabase PostgreSQL
- Auth : JWT / Supabase Auth
- Storage : Supabase Storage
- Déploiement : Vercel frontend, Railway backend, Supabase DB

## Architecture
- Multi-tenant avec tenant_id sur toutes les tables métier
- Multi-sites avec site_id
- Sécurité par rôles et permissions
- RLS Supabase à activer progressivement
- API REST documentée Swagger/OpenAPI

## Modules MVP prioritaires
1. Auth
2. Tenants
3. Users / Roles / Permissions
4. Sites
5. Articles
6. Achats
7. Lots
8. Stocks
9. Vente POS
10. Caisse

## Modules après MVP
- Assurances
- Créances
- Inventaires
- Transferts
- Comptabilité simplifiée
- Reporting BI

## Règles critiques
- Toujours filtrer par tenant_id.
- Pour les utilisateurs site, filtrer aussi par site_id.
- Ne jamais modifier le stock sans créer stock_movements.
- Les ventes doivent sortir le stock en FEFO.
- Les lots expirés ou bloqués ne doivent jamais être vendus.
- Les validations achat/vente/inventaire doivent être transactionnelles.
- Les actions sensibles doivent créer audit_logs.

## Premier objectif de développement
Créer l’environnement local :
- backend NestJS
- frontend React
- connexion Supabase
- endpoint /auth/login
- endpoint /auth/me
- endpoint /articles
- écran Login
- écran Dashboard
- écran Articles