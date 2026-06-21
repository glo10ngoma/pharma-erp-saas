# ERP Pharmaceutique SaaS V2 — Plan de Développement MVP

## Ordre recommandé

1. Swagger API complet
2. Squelette NestJS
3. Squelette React
4. MVP Core
5. Assurances
6. Créances
7. Comptabilité
8. BI

---

## MVP Core à développer en premier

### Sprint 0 — Setup
- Repos GitHub
- Supabase projet DEV
- NestJS API
- React frontend
- CI/CD simple
- Variables `.env`

### Sprint 1 — Auth + SaaS
- Login
- JWT
- Tenants
- Sites
- Users
- Roles
- Permissions
- TenantGuard
- PermissionGuard

### Sprint 2 — Référentiel
- Articles
- Catégories
- Formes galéniques
- Fournisseurs
- Clients
- Import Excel articles

### Sprint 3 — Achats + Lots + Stock
- Créer achat DRAFT
- Ajouter lignes achat
- Valider achat
- Créer lots
- Créer stocks
- Créer mouvements PURCHASE_IN

### Sprint 4 — Vente POS
- Créer vente DRAFT
- Recherche article
- Allocation FEFO
- Validation vente
- Paiement
- Mouvement SALE_OUT
- Facture simple

### Sprint 5 — Caisse
- Ouvrir session
- Encaissements
- Dépenses simples
- Fermer session
- Écart caisse

---

## Modules après MVP

### Assurances
- Organisations
- Plans assurance
- Affiliations client
- Calcul couverture
- Vente assurance

### Créances
- Créances clients
- Créances assurances
- Paiement partiel/total
- État des impayés

### Comptabilité
- Plan comptable
- Journaux
- Écritures automatiques
- Grand livre
- Balance

### BI
- CA jour/mois
- Valeur stock
- Marge brute
- Créances
- Péremptions
- Top produits

---

## Critères MVP vendable

Le MVP est vendable si une pharmacie peut :

- importer son catalogue articles ;
- saisir les achats ;
- gérer les lots et expirations ;
- vendre au comptoir ;
- encaisser ;
- imprimer une facture ;
- voir son stock réel ;
- fermer sa caisse.