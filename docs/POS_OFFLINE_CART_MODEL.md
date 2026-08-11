# POS Offline Cart Model

## Objectif

Ce document formalise le modele de panier local introduit par Sprint Offline 2.

Le but est simple :

- preparer une vente offline sans la finaliser ;
- conserver plusieurs brouillons ;
- reserver localement le quota alloue au poste ;
- survivre a un refresh, une fermeture du navigateur et un redemarrage du poste.

## Entites principales

### 1. `OfflineCart`

Conteneur principal d'un brouillon de vente offline.

Champs clefs :

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

### 2. `OfflineCartItem`

Une ligne article du brouillon.

Champs clefs :

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

### 3. `OfflineCartLotAllocation`

Repartition FEFO reelle d'une ligne sur un ou plusieurs lots.

Champs :

- `allocationId`
- `lotId`
- `lotNumber`
- `expiryDate`
- `quantity`
- `allocationServerVersion`

### 4. `OfflineDraftReservation`

Reservation locale d'une allocation pour un brouillon.

Champs :

- `reservationId`
- `cartId`
- `allocationId`
- `lotId`
- `quantity`
- `createdAt`
- `updatedAt`

## Statuts du brouillon

Les statuts actuels sont :

- `DRAFT` : brouillon vide ou simple panier en cours ;
- `READY` : brouillon coherent avec le snapshot local actuel ;
- `BLOCKED` : article, lot ou allocation devenu invalide ;
- `CANCELLED` : brouillon annule localement.

## Regle de reservation

La reservation locale est additive entre brouillons d'un meme poste.

Exemple :

- allocation disponible : 10
- brouillon A reserve 4
- brouillon B ne voit plus que 6 disponibles

La reservation du brouillon courant est reintegree pendant son propre recalcul.

## Regle de suppression

Quand une ligne est supprimee :

- la ligne sort du panier ;
- ses reservations sont relachees ;
- le total est recalcule ;
- les autres brouillons voient le quota remonter.

## Regle de quantite

Toute modification de quantite :

1. relit le snapshot local ;
2. retire implicitement les reservations du brouillon courant du calcul ;
3. recalcule un FEFO complet ;
4. reecrit les reservations ;
5. persiste le brouillon.

## Prix

Le prix enregitre dans le brouillon est un snapshot.

Source :

- prix article par defaut en priorite ;
- sinon prix lot local vendable ;
- sinon refus d'ajout.

Sprint 2 ne remplace pas silencieusement le prix d'une ligne existante.

## Payload futur

Le brouillon peut deja produire un objet pur `OfflineSaleDraftOperation`.

Cet objet est pret pour une future etape de synchronisation, mais Sprint 2 ne le
met jamais en queue automatiquement.

## Persistance

Le modele est stocke dans IndexedDB via :

- `offline_carts`
- `offline_draft_reservations`
- `offline_activity_log`

Les modifications sont autosauvegardees.

## Limite connue

Sprint 2 reserve le quota et prepare la vente, mais ne cree encore :

- aucun paiement ;
- aucune vente finale ;
- aucune consommation serveur ;
- aucune ecriture de stock central.
