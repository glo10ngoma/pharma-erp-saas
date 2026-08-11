# POS Offline Architecture

## Vision retenue

Le mode offline POS suit l'approche "allocation stricte par poste et par lot".

Le backend central reste la source de verite.
Le navigateur ne fait que :

- conserver un snapshot local IndexedDB ;
- preparer des brouillons de vente ;
- reserver localement une partie du quota deja alloue au poste ;
- recalculer un FEFO local deterministe ;
- preparer un futur payload `SALE_DRAFT_CREATE` sans l'envoyer.

Sprint Offline 2 ne cree aucune vente metier definitive.

## Sprint 0 et Sprint 1 deja en place

Le socle precedent fournit deja :

- IndexedDB ;
- snapshot local par tenant / site / poste ;
- bootstrap serveur ;
- synchronisation descendante ;
- etat reseau `ONLINE`, `DEGRADED`, `OFFLINE` ;
- autorisation offline datee ;
- allocations offline par lot ;
- FEFO local de base ;
- page `/offline/synchronisation`.

## Ce que Sprint Offline 2 ajoute

Sprint Offline 2 ajoute le premier flux de preparation de vente offline exploitable :

- route `/offline/pos` ;
- route `/offline/drafts` ;
- route `/offline/poste` ;
- menu Offline dedie ;
- recherche article 100 % locale ;
- recherche client 100 % locale ;
- panier offline persistant ;
- plusieurs brouillons simultanes ;
- reservations entre brouillons ;
- FEFO local multi-lots ;
- autosauvegarde locale ;
- payload futur `SALE_DRAFT_CREATE` construit localement mais jamais emis.

## Routes Offline

Les routes frontend exposees sont :

- `/offline/pos`
- `/offline/drafts`
- `/offline/synchronisation`
- `/offline/poste`

Le POS principal `/pos` reste totalement separe.

## Stores IndexedDB

Le stockage local utilise les stores suivants :

- `offline_articles`
- `offline_lots`
- `offline_allocations`
- `offline_customers`
- `offline_settings`
- `auth_snapshot`
- `workstation`
- `sync_state`
- `sync_queue`
- `sync_log`
- `sync_conflicts`
- `offline_carts`
- `offline_draft_reservations`
- `offline_activity_log`

Sprint 2 ajoute donc surtout :

- `offline_carts`
- `offline_draft_reservations`
- `offline_activity_log`

## Modele du panier offline

Le panier principal est `OfflineCart`.

Champs importants :

- `cartId`
- `offlineReference`
- `tenantId`
- `siteId`
- `workstationId`
- `deviceId`
- `userId`
- `customerId`
- `customerNameSnapshot`
- `currency`
- `exchangeRateSnapshot`
- `status`
- `note`
- `subtotal`
- `total`
- `itemCount`
- `quantityTotal`
- `items`
- `blockedReasons`
- `createdAt`
- `updatedAt`

Statuts supportes :

- `DRAFT`
- `READY`
- `BLOCKED`
- `CANCELLED`

## Ligne du panier

Chaque ligne `OfflineCartItem` contient :

- `localItemId`
- `articleId`
- `articleCode`
- `articleName`
- `barcode`
- `quantity`
- `unitPriceSnapshot`
- `priceSource`
- `priceVersion`
- `lineTotal`
- `salesUnit`
- `packaging`
- `packagingQuantity`
- `lotAllocations`

## Allocation par lot dans une ligne

Chaque ligne du panier memorise la repartition FEFO reelle dans `OfflineCartLotAllocation` :

- `allocationId`
- `lotId`
- `lotNumber`
- `expiryDate`
- `quantity`
- `allocationServerVersion`

Cette version sera necessaire plus tard lors de la synchronisation montante.

## Distinction critique

Deux notions doivent rester strictement separees.

### `localDraftReservation`

Reservation locale d'un brouillon non finalise.

Elle sert uniquement a eviter que deux brouillons du meme poste se reservent la
meme quantite.

### `localPendingConsumption`

Quantite d'une vente offline deja finalisee localement mais pas encore confirmee
par le serveur.

Sprint Offline 2 n'y touche pas.

En resume :

`localDraftReservation != localPendingConsumption`

## Regle de disponibilite offline

La disponibilite d'un article en offline ne depend jamais directement du stock
central.

Elle depend uniquement des allocations du poste.

Pour une allocation :

`effectiveAvailable = serverAllocatedQuantity - serverConsumedQuantity - localPendingConsumption`

Pour un brouillon courant :

`availableForCart = effectiveAvailable - reservationsOtherDrafts`

## Regles FEFO locales

Le FEFO local utilise :

- seulement les allocations du poste ;
- seulement les allocations `ACTIVE` ;
- jamais les lots bloques ;
- jamais les lots expires ;
- tri par `expiryDate ASC`, puis `lotNumber ASC`.

La repartition peut etre multi-lots.

Exemple :

- LOT-A : 2
- LOT-B : 5
- demande : 4

Resultat :

- LOT-A : 2
- LOT-B : 2

## Recherche locale

### Articles

La recherche POS Offline lit uniquement `offline_articles`.

Critere :

- `commercialName`
- `articleCode`
- `barcode`

Elle ne depend d'aucun appel `/articles`, `/lots` ou `/stocks` pendant la saisie.

### Clients

La recherche client lit uniquement `offline_customers`.

Critere :

- `name`
- `customerCode`
- `phone`

## Prix snapshot

Le prix de vente d'une ligne utilise :

1. `article.defaultSellingPrice` si present ;
2. sinon le premier prix de lot vendable du snapshot local.

Si aucun prix valable n'est disponible :

- l'article reste visible ;
- l'ajout au panier est refuse ;
- aucun prix `0` n'est invente.

## Brouillons multiples

Sprint 2 autorise plusieurs brouillons en parallele sur un meme poste.

Exemple :

- allocation disponible : 10
- brouillon A reserve 4
- brouillon B ne peut plus preparer que 6

L'annulation ou la reduction du brouillon A libere immediatement cette reserve.

## Revalidation apres synchro

Une synchronisation descendante ne doit jamais ecraser silencieusement un
brouillon.

Le brouillon est revalide apres lecture du snapshot local :

- article devenu inactif ;
- lot bloque ;
- lot expire ;
- allocation suspendue ;
- allocation revoquee ;
- quota insuffisant.

Dans ces cas, le brouillon passe a `BLOCKED`.

## Journal local

Le store `offline_activity_log` conserve des evenements utiles :

- `cart.created`
- `cart.item_added`
- `cart.item_removed`
- `cart.quantity_changed`
- `cart.blocked`
- `cart.cancelled`
- `fefo.recalculated`
- `reservation.created`
- `reservation.released`

## Ce que Sprint Offline 2 ne fait pas

Sprint 2 ne fait toujours pas :

- encaissement offline ;
- paiement offline ;
- validation metier definitive ;
- mouvement de stock central ;
- consommation officielle serveur ;
- ouverture / fermeture de caisse offline ;
- mise en queue automatique d'une vraie vente.

Le payload `SALE_DRAFT_CREATE` est seulement prepare localement.

## Limites restantes

- pas encore de finalisation offline ;
- pas encore de file montante pour les ventes ;
- pas encore de gestion de paiement ;
- pas encore de caisse offline ;
- pas encore de creation client offline synchronisable ;
- pas encore de resolution serveur des vrais conflits de vente.

## Direction Sprint Offline 3

Le Sprint Offline 3 devra normalement couvrir :

- finalisation locale d'une vente offline ;
- creation d'une operation sync montante ;
- passage controle de reservation locale vers pending consumption ;
- conflits serveur a la remontee ;
- reprise et resolution des ventes en attente ;
- garde-fous caisse et paiement offline.
