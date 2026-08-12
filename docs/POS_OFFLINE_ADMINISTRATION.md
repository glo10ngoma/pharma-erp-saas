# POS Offline Administration

## Perimetre

Le centre d administration offline couvre :

- supervision des postes ;
- heartbeat ;
- journal offline ;
- allocations par poste / lot ;
- conflits de synchronisation ;
- revocation d un poste.

## Pages frontend

- `/offline-admin/dashboard`
- `/offline-admin/workstations`
- `/offline-admin/workstations/:id`
- `/offline-admin/allocations`
- `/offline-admin/conflicts`
- `/offline-admin/logs`

## Permissions

- `pos_offline.admin.read`
- `pos_offline.workstations.read`
- `offline_allocations.read`
- `offline_allocations.manage`
- `offline_allocations.transfer`
- `offline_allocations.rebalance`
- `pos_sync.conflicts.read`
- `pos_sync.conflicts.resolve`
- `pos_sync.logs.read`

## Statuts poste

- `ONLINE`
- `STALE`
- `OFFLINE`
- `DEGRADED`
- `REVOKED`

## Revocation d un poste

La revocation :

- passe `pos_workstations.offline_status` a `REVOKED` ;
- refuse les futurs `heartbeat`, `bootstrap` et `operations` ;
- libere les quantites offline restantes non consommees ;
- conserve l historique et les ventes deja finalisees.

## Allocations

Actions supportees :

- create
- update API
- suspend
- release
- revoke
- transfer
- rebalance

### Regles

- `SUSPENDED` reste reserve mais non vendable offline ;
- `REVOKED` restitue le reliquat non consomme ;
- aucune quantite deja consommee ne migre ;
- le stock libre online ne doit jamais devenir negatif.

## Conflits

Le centre de conflits permet :

- liste ;
- detail ;
- mise sous revue ;
- cloture manuelle ;
- dismissal explicite.

Les conflits sont journalises dans `pos_sync_conflicts` et audites.

## Validation

Le script cible est :

`npm run validate:offline4`

Il doit etre complete par :

- `npm run validate:mvp -- all`
- `npm run validate:v1`
- `npm run validate:rc1`
- `node scripts/validate-offline-32.js`
