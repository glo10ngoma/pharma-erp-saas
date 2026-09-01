# POS Offline Cash

## Portee V1 Offline 5.1

Cette iteration couvre uniquement la caisse offline locale du POS:

- ouverture locale de session;
- depense locale;
- rattachement des ventes offline cash a une session locale;
- comptage local;
- fermeture locale;
- replay serveur via la queue offline existante.

Ne sont pas inclus ici:

- assurance offline;
- credit offline;
- remboursement offline;
- retour client offline;
- Mobile Money offline;
- multi-session offline simultanee par poste;
- comptabilite offline autonome.

## Cycle de vie

1. `CASH_SESSION_OPEN`
2. `SALE_VALIDATE`
3. `CASH_EXPENSE`
4. `CASH_SESSION_CLOSE`

Le moteur de sync reste unique. Il traite maintenant plusieurs `operationType` dans la meme queue.

## Queue et dependances

Chaque operation offline de caisse est stockee dans IndexedDB avec:

- `operationId`
- `operationType`
- `relatedLocalCashSessionId`
- `dependsOnOperationId`
- `dependencyGroup`

Regles:

- une depense ou une vente peut dependre de l ouverture locale si la session serveur n a pas encore ete acquittee;
- une fermeture n est eligible que si toutes les operations precedentes de la meme session sont deja `SYNCED`;
- un conflit sur une session ne doit pas bloquer les autres sessions independantes.

## ACK cash

### Ouverture

ACK attendu:

- `serverCashSessionId`
- `serverSessionReference`
- `serverVersion`
- `serverOpenedAt`

Effets locaux:

- queue -> `SYNCED`
- session -> `OPEN_SYNCED`
- mouvements d ouverture -> `SYNCED`

### Depense

ACK attendu:

- `serverCashSessionId`
- `serverMovementId`
- `serverVersion`

Effets locaux:

- queue -> `SYNCED`
- mouvement de depense -> `SYNCED`
- session locale conserve ses totaux deja calcules

### Fermeture

ACK attendu:

- `serverCashSessionId`
- `serverSessionReference`
- `serverClosedAt`
- `serverExpectedUsd/Cdf`
- `serverDeclaredUsd/Cdf`
- `serverDifferenceUsd/Cdf`
- `serverVersion`

Effets locaux:

- queue -> `SYNCED`
- session -> `CLOSED_SYNCED`
- mouvements de fermeture -> `SYNCED`
- theorique local et theorique serveur restent stockes separement

## Expected / Declared / Difference

Le frontend calcule un theorique local pour guider l utilisateur.

Le serveur recalcule toujours son theorique a partir des mouvements en base:

- opening
- cash sales
- expenses
- refunds
- adjustments

Le serveur ne fait pas confiance au theorique frontend pour la validation finale.

## Reconciliation

Si `serverExpected` differe de `localExpected` au dela de la tolerance metier:

- conflit `CASH_EXPECTED_BALANCE_MISMATCH`
- operation de fermeture -> `CONFLICT`
- evenement de reconciliation local enregistre

## Crash recovery

Au redemarrage:

- les operations `SYNCING` trop anciennes repassent en `PENDING`;
- l `operationId` est conserve;
- la session locale et ses mouvements restent persistants dans IndexedDB.

## Idempotence

Le backend utilise `pos_sync_operations` pour:

- detecter `ALREADY_PROCESSED`;
- renvoyer les identifiants serveur deja associes;
- eviter une deuxieme ouverture / depense / fermeture.

## Multi-devise

Les montants USD et CDF sont conserves separement:

- pas d addition directe USD + CDF;
- pas de fusion silencieuse;
- theorique, declare et ecart restent distincts par devise.

## Routes frontend

- `/pos`
- `/offline/pos`
- `/offline/cash`
- `/offline/sales`
- `/offline/synchronisation`
- `/offline-admin/cash-sessions`

## Nettoyage de recette

Utiliser:

- `database/cleanup_offline_5_demo.sql`

Ce script cible uniquement:

- tenant `OFFLINE_STAGING`
- references `OFF-CASH-*`
- identifiants `OFF-STG-*`

Il ne doit jamais etre reutilise comme nettoyage global de production.
