# POS Offline Allocation Model

## Vision

Le poste de travail recoit une allocation locale par article et par lot.
Cette allocation est une copie de travail, pas un stock central.

## Statuts

### ACTIVE

Allocation disponible pour consommation locale.

### EXHAUSTED

Allocation totalement consommee.

### SUSPENDED

Allocation temporairement bloquee, par exemple pour quarantaine ou lot bloque.

### REVOKED

Allocation revoquee par le serveur ou par une regle de gouvernance.

En Offline 4, la revocation d un poste revoque aussi ses reliquats non consommes :

- les quantites deja consommees restent historiques ;
- le reliquat non consomme redevient vendable online ;
- le poste ne peut plus rebooter offline ni rejouer de nouvelles operations.

## Champs de l'allocation

- `allocationId`
- `tenantId`
- `siteId`
- `workstationId`
- `articleId`
- `lotId`
- `lotNumber`
- `expiryDate`
- `isBlocked`
- `blockingReason`
- `serverAllocatedQuantity`
- `serverConsumedQuantity`
- `localPendingConsumption`
- `allocationStatus`
- `serverVersion`
- `lastSyncedAt`

## Calculs

### Quantite disponible locale

`effectiveAvailable = max(0, serverAllocatedQuantity - serverConsumedQuantity - localPendingConsumption)`

### Stock vendable online

`sellableOnline = max(0, physicalAvailable - offlineReservedQuantity)`

avec :

`offlineReservedQuantity = SUM(allocated_quantity - consumed_quantity) WHERE status='ACTIVE'`

### Vendabilite locale

Une allocation est vendable seulement si :

- le statut est `ACTIVE` ;
- `isBlocked` vaut `false` ;
- la quantite disponible locale est strictement positive ;
- la date d'expiration est posterieure a la date de vente locale.

## FEFO local

Le tri local privilegie :

1. la date d'expiration la plus proche ;
2. puis le numero de lot.

## Replay serveur

Le replay doit consommer exactement :

- le `allocationId` ;
- le `lotId` ;
- la `quantity` ;
- la `allocationServerVersion` connue localement.

La vente serveur ne doit jamais remplacer ces lots par un FEFO recalcule article
par article.

## Conflits prevus

- allocation epuisee ;
- allocation revoquee ;
- lot bloque apres la vente locale ;
- lot expire a la date de vente locale ;
- quantite insuffisante ;
- stock central devenu incoherent ;
- workstation/site/tenant mismatch.

## Administration Offline 4

Le centre d administration offline permet maintenant :

- la supervision des allocations ;
- le transfert et le reequilibrage ;
- la suspension et la revocation ;
- la lecture des impacts via `/pos-sync/changes`.
