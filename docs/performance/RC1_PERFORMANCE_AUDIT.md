# RC1 Performance Audit

Date: 28/06/2026

## Objectif

Audit de performance V1.0 RC1 sans nouvelle fonctionnalite metier et sans modification des regles validees.

## Mesure initiale frontend

Commande:

```bash
cd frontend
npm run build
```

Resultat initial Vite:

| Asset | Taille | Gzip |
| --- | ---: | ---: |
| `assets/index-DtowjJz0.css` | 53.07 kB | 9.41 kB |
| `assets/index-wBvrKyPA.js` | 1,072.83 kB | 281.70 kB |

Constat: tout le frontend applicatif etait regroupe dans un seul chunk JavaScript principal. Vite signalait un chunk superieur a 500 kB.

## Routes les plus lourdes

Les pages suivantes etaient importees au demarrage via `frontend/src/App.tsx` alors qu'elles ne sont pas necessaires pour ouvrir les flux rapides:

- Dashboard BI: graphiques et plusieurs appels de rapports.
- Rapports imprimables: tables, exports, agregations.
- Analyses avancees: graphiques Recharts et calculs Pareto/rotation/marges.
- Notifications: generation de notifications a partir de plusieurs domaines.
- Assurance V2: vues de suivi, litiges, relances, bordereaux.
- Finance: comptes, journaux, ecritures, grand livre, balance.
- Administration: audit, numerotation, caisses, configuration, sauvegardes.

## Recharts

`recharts` etait importe par:

- `frontend/src/modules/reports/ReportsDashboardPage.tsx`
- `frontend/src/modules/analytics/AnalyticsPages.tsx`

Avant optimisation, ces imports etaient presents dans le bundle initial meme pour un utilisateur qui arrive directement sur le POS.

## Appels API et calculs

Observations principales:

- Le Dashboard BI charge plusieurs rapports en parallele via React Query.
- Les pages Reports et Analytics declenchent des appels metier uniquement quand elles sont montees.
- Les pages Stocks/Lots utilisent deja `useMemo` pour filtres/KPI et chargent les mouvements de stock a la demande sur Lots.
- Certaines pages FEFO/BI utilisent `articlesService.getAll({ limit: 1000 })` pour des calculs de synthese. Cela reste confine aux pages correspondantes et n'est pas appele au demarrage apres lazy loading.
- POS conserve des `useMemo` pour les lots vendables, le FEFO et les recherches article/client. Il reste charge directement pour eviter de ralentir l'ouverture caisse.

## React Query

Aucun cache global agressif n'a ete ajoute pendant RC1.4.

Raison: POS, stocks, caisse et ventes en cours ne doivent pas recevoir de donnees trop anciennes. Les donnees stables comme referentiels, sites, roles, permissions, categories ou taux de change pourront recevoir des `staleTime` par requete en V2, avec tests cibles par page.

## Tables longues

Les pages metier modernes utilisent deja:

- tableaux compacts;
- headers sticky;
- filtres memoises avec `useMemo`;
- exports sur donnees filtrees.

La virtualisation n'a pas ete ajoutee en RC1.4 car elle serait plus risquee pour les tableaux deja valides et leurs actions clavier/modals.

## Risques identifies

- Le chunk initial reste legerement superieur a 500 kB, car les flux critiques restent charges directement: POS, achats, stocks, lots, inventaires, articles, ventes et referentiel.
- Le Dashboard BI admin charge encore Recharts apres redirection admin. C'est voulu: les graphiques sont necessaires sur cette page, mais ils ne penaliseront plus le POS.
- Les caches React Query doivent etre ajoutes progressivement par domaine, pas globalement.

