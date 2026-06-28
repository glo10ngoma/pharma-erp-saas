# RC1 Test Plan - ERP Pharmaceutique SaaS V1.0

## Objectif

Cette campagne de recette valide que la release candidate RC1 couvre les workflows critiques de l'ERP Pharmaceutique SaaS sans regression sur les modules deja stabilises.

## Perimetre

La recette couvre :

- Authentification et permissions.
- Referentiel pharmaceutique.
- Achats, lots et stocks.
- Inventaires et transferts.
- POS, ventes, caisse et facturation.
- Assurances et creances.
- Finance et comptabilite.
- Dashboard BI, rapports, notifications et analyses.
- Administration.

## Hors perimetre

- Nouvelles fonctionnalites.
- Modification des regles metier.
- Refonte UX.
- Tests de charge avances.
- Tests de securite offensifs.

## Environnement de recette

- Backend NestJS local ou staging.
- Frontend Vite local ou Vercel staging.
- Base PostgreSQL Supabase avec seed DEV/STAGING/DEMO applique.
- Compte admin : `admin@demo.local` en local ou compte staging equivalent.
- Navigateur : Chrome/Edge recent.

## Pre-requis

1. Appliquer le schema PostgreSQL V3.
2. Appliquer le seed DEV ou STAGING.
3. Verifier les variables `.env`.
4. Demarrer le backend.
5. Demarrer le frontend.
6. Ouvrir une session caisse avant les tests POS/Caisse.

## Strategie de test

- Executer les validations automatisees avant la recette manuelle.
- Derouler les scenarios E2E dans l'ordre.
- Verifier les exports sur les pages principales.
- Verifier light/dark sur les ecrans critiques.
- Documenter tout FAIL/BLOCKED dans `RC1_TEST_RESULTS.md`.

## Commandes de validation

Depuis `backend/` :

```bash
npm run build
npm run validate:mvp -- all
npm run validate:v1
npm run validate:rc1
```

Depuis `frontend/` :

```bash
npm run build
```

## Criteres d'acceptation

- Aucun ecran blanc.
- Aucun bouton critique invisible.
- Aucun workflow critique bloque.
- `validate:mvp -- all` OK.
- `validate:v1` OK.
- `validate:rc1` OK si disponible.
- Builds frontend/backend OK.

## Criteres de rejet RC1

- POS inutilisable.
- Vente CASH ou ASSURANCE impossible.
- Stock modifie sans mouvement.
- Achat valide ne cree pas lot/stock.
- Caisse incoherente.
- Balance comptable desequilibree apres workflows standards.
- Login admin impossible.
- Dashboard BI ou routes principales en page blanche.
