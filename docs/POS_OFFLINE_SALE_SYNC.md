# POS Offline Sale Sync

## Portee

Le Sprint Offline 3.x active une vente offline reelle pour le POS Pharmacie :

- panier local persistant ;
- paiement cash local ;
- validation locale de la vente ;
- conversion des `localDraftReservation` en `localPendingConsumption` ;
- file `sync_queue` avec operation `SALE_VALIDATE` ;
- replay serveur idempotent via `POST /pos-sync/operations` ;
- historique local des ventes offline ;
- ACK serveur allocation par allocation.

## Sequence locale

1. Le vendeur prepare un brouillon offline.
2. Le poste verifie qu'une session caisse `OPEN` synchronisee existe localement.
3. Le paiement USD/CDF est calcule localement.
4. La validation locale cree :
   - une vente offline ;
   - un paiement offline ;
   - des pending consumptions ;
   - une entree `SALE_VALIDATE` dans la queue ;
   - un journal local.
5. Les reservations du brouillon sont retirees.
6. La vente ne redevient jamais `DRAFT`.

## Stores IndexedDB utilises

- `offline_carts`
- `offline_draft_reservations`
- `offline_cash_sessions`
- `offline_sales`
- `offline_payments`
- `offline_pending_consumptions`
- `sync_queue`
- `offline_activity_log`

## Replay serveur

Le replay passe par `POST /pos-sync/operations`.

Pour `SALE_VALIDATE`, le backend :

1. verifie l'idempotence via `pos_sync_operations` ;
2. recharge chaque allocation offline demandee ;
3. verrouille allocation, lot puis stock ;
4. verifie tenant, site, workstation, article, lot, statut et quantite restante ;
5. cree la vente serveur ;
6. recree les `sale_items` exacts lot par lot ;
7. valide la vente avec le moteur central partage ;
8. incremente `consumed_quantity` et `server_version` sur chaque allocation ;
9. renvoie un ACK detaille par allocation.

Offline 4 ajoute par-dessus :

10. la remontee des conflits dans `pos_sync_conflicts` ;
11. la supervision admin via dashboard / postes / journal ;
12. la propagation descendante des conflits ouverts ou resolus.

## Ordre de verrouillage

L'ordre retenu est volontairement stable :

1. allocation offline (`offline_stock_allocations ... FOR UPDATE`) ;
2. lot (`lots ... FOR UPDATE`) ;
3. stock (`stocks ... FOR UPDATE`).

Ce verrouillage reduit le risque de divergence entre le lot choisi offline et le
lot effectivement consomme au replay.

## Regles de vente offline rejouee

- le replay ne repasse plus par un FEFO generique par article ;
- la date de reference pour l'expiration est `validatedAt` local, pas la date du sync ;
- un lot bloque apres la vente locale remonte `LOT_BLOCKED_AFTER_OFFLINE_SALE` ;
- une allocation stale reste acceptable si le meme lot est toujours present et que
  la quantite restante suffit ;
- un traitement idempotent ne doit jamais doubler ni la consommation, ni le
  paiement, ni les mouvements caisse.

## Protection du stock online

La quantite reservee offline doit etre exclue du stock libre online :

`offlineReservedQuantity = SUM(allocated_quantity - consumed_quantity) WHERE status='ACTIVE'`

Cette protection est appliquee sur :

- la vente online FEFO ;
- la validation de vente immediate ;
- les allocations de retrait (`ADVANCE`) ;
- les transferts.

## Limites restantes

- V1 offline limitee a `CASH` + `IMMEDIATE`.
- Pas d'assurance offline.
- Pas de credit client offline.
- Pas de retour client offline.
- Pas d'ouverture de caisse completement offline.
- Les inventaires peuvent rendre une allocation incoherente avec le stock physique ;
  le systeme doit alors remonter un conflit ou un avertissement, sans auto-correction
  silencieuse.

## Revocation poste

Si le poste est revoque avant le replay :

- le serveur refuse `heartbeat`, `bootstrap` et `operations` ;
- les nouvelles ventes offline ne doivent plus etre synchronisables ;
- le reliquat non consomme de ses allocations doit etre rendu au online sellable.
