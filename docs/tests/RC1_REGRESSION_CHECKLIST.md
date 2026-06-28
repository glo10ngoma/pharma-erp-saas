# RC1 Regression Checklist

Utiliser cette checklist avant chaque release ou deploiement staging/production.

## Builds et scripts

- [ ] `cd frontend && npm run build`
- [ ] `cd backend && npm run build`
- [ ] `cd backend && npm run validate:mvp -- all`
- [ ] `cd backend && npm run validate:v1`
- [ ] `cd backend && npm run validate:rc1`

## Routes principales

- [ ] `/login`
- [ ] `/reports/dashboard`
- [ ] `/notifications`
- [ ] `/analytics`
- [ ] `/articles`
- [ ] `/purchases`
- [ ] `/purchases/new`
- [ ] `/lots`
- [ ] `/stocks`
- [ ] `/inventories`
- [ ] `/transfers`
- [ ] `/pos`
- [ ] `/sales`
- [ ] `/cash`
- [ ] `/insurance/dashboard`
- [ ] `/insurance/receivables`
- [ ] `/accounting/entries`
- [ ] `/reports`
- [ ] `/users`

## POS

- [ ] POS s'ouvre sans ecran blanc.
- [ ] Client comptoir par defaut.
- [ ] Client selectionnable.
- [ ] CASH par defaut.
- [ ] ASSURANCE selectionnable.
- [ ] Scan/recherche article fonctionne.
- [ ] Meme article/lot fusionne la quantite.
- [ ] Paiement FC OK.
- [ ] Paiement USD OK.
- [ ] Paiement mixte OK.
- [ ] Paiement exact OK.
- [ ] Facture imprimable.
- [ ] Mode caisse OK.
- [ ] Affichage client OK.

## Achats

- [ ] Liste achats visible.
- [ ] Export achats visible en light/dark.
- [ ] `/purchases/new` sans grand espace vide.
- [ ] Popover article visible.
- [ ] Achat multi-lignes enregistrable.
- [ ] Validation achat cree lots et stock.

## Stocks / Lots / FEFO

- [ ] Lots visibles.
- [ ] Stocks visibles.
- [ ] Stock a date fonctionne.
- [ ] FEFO highlight visible.
- [ ] FEFO rotation visible.
- [ ] Exports lots/stocks OK.

## Inventaires / Transferts

- [ ] Inventaire creation/demarrage/cloture/validation OK.
- [ ] Ecarts stock calcules.
- [ ] Mouvements INVENTORY_GAIN/LOSS crees.
- [ ] Transfert inter-site valide.
- [ ] Mouvements TRANSFER_OUT/TRANSFER_IN crees.

## Finance

- [ ] Ecritures visibles.
- [ ] Grand livre visible.
- [ ] Balance equilibree.
- [ ] Exports finance OK.

## Dashboard BI / Rapports

- [ ] Admin arrive sur Dashboard BI.
- [ ] Graphiques visibles.
- [ ] Filtre site fonctionne.
- [ ] Rapports ventes/achats/stocks/inventaires/FEFO/caisse/assurance/marges visibles.
- [ ] Impression fonctionne.
- [ ] Exports Excel/CSV/JSON OK.

## Notifications / Analyses

- [ ] Badge notifications visible.
- [ ] Notifications stock/FEFO/creances/caisse visibles.
- [ ] Marquer lu/non lu fonctionne.
- [ ] Liens modules fonctionnent.
- [ ] ABC/Pareto visible.
- [ ] Rotation stock visible.
- [ ] Produits dormants visible.
- [ ] Marges/fournisseurs/vendeurs visibles.

## Administration

- [ ] Utilisateurs visibles.
- [ ] Roles visibles.
- [ ] Permissions visibles.
- [ ] Sites visibles.
- [ ] Caisses visibles.
- [ ] Taux de change visible.
- [ ] Audit logs visibles.
- [ ] Sauvegardes/export configuration visible.

## UI globale

- [ ] Aucun bouton invisible.
- [ ] Aucun contraste incorrect.
- [ ] Aucun scroll horizontal inutile sur desktop.
- [ ] Tables compactes.
- [ ] Headers sticky.
- [ ] Dates au format jj/mm/aaaa.
- [ ] Montants coherents.
- [ ] Light theme OK.
- [ ] Dark theme OK.
- [ ] Modals homogenes.
- [ ] Loaders homogenes.
- [ ] Empty states homogenes.
