# POS Offline Autosync

## Objectif

Le moteur d auto-sync synchronise automatiquement les ventes offline locales vers
le backend sans action explicite du vendeur des qu une connectivite exploitable
revient.

## Triggers

- timer periodique ;
- retour online du navigateur ;
- retour au premier plan (`visibilitychange`) ;
- notification immediate apres validation locale d une vente offline.

## Etats exposes

- `IDLE`
- `CHECKING`
- `SYNCING`
- `BACKOFF`
- `OFFLINE`
- `DEGRADED`
- `CONFLICT`
- `ERROR`

## Garde-fous

### Mutex

Une seule boucle `runSync()` peut etre active a la fois.

### Recovery des `SYNCING`

Au redemarrage, les operations restees en `SYNCING` trop longtemps sont remises
en `PENDING` pour etre rejouees proprement.

### ACK perdu

Le serveur reste idempotent via `pos_sync_operations (tenant_id, operation_id)`.
Un retry d une operation deja traitee doit revenir en `ALREADY_PROCESSED`, puis
etre converti localement en `SYNCED`.

## Backoff

Paliers actuels :

- 1 minute
- 2 minutes
- 5 minutes
- 10 minutes
- 30 minutes

## Synchronisation descendante

Apres une synchronisation montante reussie, le poste relance `/pos-sync/changes`
pour recuperer :

- allocations ;
- lots ;
- clients ;
- taux ;
- conflits ouverts / resolus.

## Heartbeat

Le moteur publie un heartbeat leger pour remonter :

- dernier curseur ;
- pending count ;
- conflict count ;
- version app ;
- version DB locale ;
- etat snapshot.

## Limites V1

- pas encore de websocket ;
- pas encore de resolution locale automatique de conflits complexes ;
- les scenarios de reprise doivent etre valides par `validate:offline4`.
