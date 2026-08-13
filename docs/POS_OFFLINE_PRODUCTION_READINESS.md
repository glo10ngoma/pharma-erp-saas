# POS Offline - Production Readiness Offline 6

## Objectif

Offline 6 stabilise le POS offline sans ajouter de nouvelle fonctionnalite commerciale. Le principe prioritaire reste inchangé : une vente encaissée localement ne doit jamais etre perdue silencieusement.

## IndexedDB local

- Nom DB : `PharmaErpPosDb`
- Version courante : `OFFLINE_DB_VERSION = 6`
- Version schema snapshot : `OFFLINE_SNAPSHOT_SCHEMA_VERSION = 2`
- Store de metadata : `offline_metadata`

Stores critiques :

- `offline_sales`
- `offline_payments`
- `offline_pending_consumptions`
- `sync_queue`
- `offline_cash_sessions`
- `offline_cash_movements`
- `offline_cash_counts`
- `offline_cash_reconciliation_events`
- `sync_conflicts`
- `offline_draft_reservations`

Stores reconstructibles par bootstrap :

- `offline_articles`
- `offline_lots`
- `offline_allocations`
- `offline_customers`
- `offline_settings`
- `auth_snapshot`
- `workstation`
- `sync_state`

Stores de confort / audit local :

- `offline_carts`
- `offline_activity_log`
- `sync_log`

Aucune suppression globale de base (`indexedDB.deleteDatabase`) ne doit exister dans le runtime normal.

## Migration

La migration v5 -> v6 est additive et non destructive : elle cree uniquement le store `offline_metadata` si absent. Les ventes, paiements, sessions caisse, consommations en attente, conflits et operations de synchronisation existants sont conserves.

Si une future migration ne peut pas garantir la conservation des donnees critiques, le poste doit passer en `RECOVERY_REQUIRED` et bloquer les nouvelles operations commerciales offline jusqu'a intervention.

## Recovery au demarrage

Le module `offline-recovery.ts` controle :

- ventes locales sans operation de synchronisation ;
- ventes locales sans paiement ;
- ventes liees a une session caisse absente ;
- operations de queue liees a une vente absente ;
- consommations en attente sans vente ;
- mouvements caisse sans session ;
- reservations brouillon orphelines ;
- operations `SYNCING` trop anciennes remises en `PENDING`.

Statuts possibles :

- `HEALTHY`
- `DEGRADED`
- `RECOVERY_REQUIRED`
- `BLOCKED`

Les controles actuels sont conservateurs : ils signalent les incoherences et ne suppriment pas les donnees critiques.

## Stockage local

La page `/offline/poste` affiche l'estimation `navigator.storage.estimate()` :

- `HEALTHY` : utilisation inferieure a 70 %
- `WARNING` : utilisation entre 70 % et 85 %
- `CRITICAL` : utilisation superieure ou egale a 85 %
- `UNKNOWN` : information navigateur indisponible

Un bouton demande la persistance du stockage via `navigator.storage.persist()` lorsque le navigateur le permet.

## Retention locale

Configuration centrale :

- ventes synchronisees : 90 jours ;
- queue synchronisee : 30 jours ;
- logs locaux : 30 jours ;
- conflits resolus : 90 jours.

Offline 6 expose une preview de retention et conserve une strategie defensive : aucune donnee `PENDING`, `SYNCING`, `CONFLICT`, `FAILED`, caisse non synchronisee ou consommation en attente n'est purgee.

## Diagnostic exportable

La page Poste peut exporter un JSON de diagnostic contenant :

- versions locales ;
- statut recovery ;
- statut stockage ;
- compteurs de queue, ventes, paiements, consommations, conflits ;
- contexte poste non sensible.

Le diagnostic ne doit jamais contenir JWT, mot de passe, token, cookie ou detail patient nominatif.

## PWA

Un manifest minimal `PharmaERP POS` est disponible pour preparer l'installation en mode standalone.

Le service worker applicatif n'est pas active en Offline 6. Le cache navigateur de l'application shell sera ajoute seulement avec une strategie d'update explicite qui ne remplace pas l'application pendant une vente active ou une synchronisation critique.

## Limites restantes

- La retention supprime actuellement zero en runtime produit ; elle donne une preview securisee.
- Les reparations automatiques restent limitees aux operations `SYNCING` trop anciennes.
- Les migrations destructives futures doivent etre bloquees par un protocole de recovery dedie.
- Le PWA n'a pas encore de service worker app-shell ni d'icones dediees.
