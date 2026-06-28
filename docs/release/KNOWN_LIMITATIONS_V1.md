# Known Limitations V1.0 RC1

Date: 28/06/2026

## Assurance / Creances

- Bordereaux, litiges et relances assurance V2 ont des elements frontend/localStorage.
- Pas encore de workflow complet backend pour toutes les operations assurance avancees.

## PDF / Impression

- PDF desactive ou placeholder sur plusieurs pages.
- Impression navigateur disponible pour factures/rapports selon pages.
- Generation PDF professionnelle a planifier.

## Stock a date

- Le stock historique est reconstruit a partir de `stock_movements`.
- Si l'historique est incomplet, le stock a date reste theorique.
- Pas de snapshot periodique natif en V1.

## Analyses

- Certaines analyses sont estimatives:
  - rotation stock;
  - produits dormants;
  - marges;
  - dependance fournisseur;
  - vendeurs si donnees utilisateur insuffisantes.

## Notifications

- Notifications generees cote frontend au chargement.
- Pas de websocket.
- Pas de cron backend.
- Pas de moteur temps reel.

## Securite

- Rate limit login en memoire seulement.
- Pas de store Redis partage.
- Helmet/CSP complet non active en RC1.
- `npm audit` signale des vulnerabilites a traiter par upgrade technique dedie.

## Performance

- Le chunk initial reste autour de 539.95 kB minifie.
- Dashboard BI, rapports et analyses doivent etre surveilles sur gros volumes.
- Pagination backend avancee a renforcer en V2.

## Multi-tenant / RLS

- Multi-tenant applique par backend JWT/SQL.
- RLS Supabase a activer progressivement apres tests dedies.

## RH / Personnel

- Pas encore de module Personnel/RH.
- Les roles utilisateurs couvrent la securite applicative, pas la gestion RH.

## Multi-devise

- Comptabilite interne USD.
- POS affiche/encaisse FC avec conversion.
- Pas encore de module complet de gestion historique avancee des taux.

## Deploiement

- Pilote recommande sur environnement controle.
- Supervision et sauvegardes a verifier manuellement.

